import type { Prisma } from "@prisma/client";
import type { GetServerSidePropsContext, NextApiResponse } from "next";

import stripe from "@calcom/app-store/stripepayment/lib/server";
import { getPremiumPlanProductId } from "@calcom/app-store/stripepayment/lib/utils";
import { passwordResetRequest } from "@calcom/features/auth/lib/passwordResetRequest";
import hasKeyInMetadata from "@calcom/lib/hasKeyInMetadata";
import { getTranslation } from "@calcom/lib/server";
import { checkUsername } from "@calcom/lib/server/checkUsername";
import { resizeBase64Image } from "@calcom/lib/server/resizeBase64Image";
import slugify from "@calcom/lib/slugify";
import { updateWebUser as syncServicesUpdateWebUser } from "@calcom/lib/sync/SyncServiceManager";
import { validateBookerLayouts } from "@calcom/lib/validateBookerLayouts";
import { prisma } from "@calcom/prisma";
import { IdentityProvider } from "@calcom/prisma/enums";
import { userMetadata } from "@calcom/prisma/zod-utils";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

import { TRPCError } from "@trpc/server";

import type { TUpdateProfileInputSchema } from "./updateProfile.schema";

type UpdateProfileOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
    res?: NextApiResponse | GetServerSidePropsContext["res"];
  };
  input: TUpdateProfileInputSchema;
};

export const updateProfileHandler = async ({ ctx, input }: UpdateProfileOptions) => {
  const { user } = ctx;
  const data: Prisma.UserUpdateInput = {
    ...input,
    metadata: input.metadata as Prisma.InputJsonValue,
  };

  // some actions can invalidate a user session.
  let signOutUser = false;
  let passwordReset = false;
  let isPremiumUsername = false;

  const layoutError = validateBookerLayouts(input?.metadata?.defaultBookerLayouts || null);
  if (layoutError) {
    const t = await getTranslation("en", "common");
    throw new TRPCError({ code: "BAD_REQUEST", message: t(layoutError) });
  }

  if (input.username && !user.organizationId) {
    const username = slugify(input.username);
    // Only validate if we're changing usernames
    if (username !== user.username) {
      data.username = username;
      const response = await checkUsername(username);
      isPremiumUsername = response.premium;
      if (!response.available) {
        throw new TRPCError({ code: "BAD_REQUEST", message: response.message });
      }
    }
  }
  if (input.avatar) {
    data.avatar = await resizeBase64Image(input.avatar);
  }
  const metadata = userMetadata.parse(user.metadata);

  const isPremium = metadata?.isPremium;
  if (isPremiumUsername) {
    const stripeCustomerId = metadata?.stripeCustomerId;
    if (!isPremium || !stripeCustomerId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "User is not premium" });
    }

    const stripeSubscriptions = await stripe.subscriptions.list({ customer: stripeCustomerId });

    if (!stripeSubscriptions || !stripeSubscriptions.data.length) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No stripeSubscription found",
      });
    }

    // Iterate over subscriptions and look for premium product id and status active
    // @TODO: iterate if stripeSubscriptions.hasMore is true
    const isPremiumUsernameSubscriptionActive = stripeSubscriptions.data.some(
      (subscription) =>
        subscription.items.data[0].price.product === getPremiumPlanProductId() &&
        subscription.status === "active"
    );

    if (!isPremiumUsernameSubscriptionActive) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You need to pay for premium username",
      });
    }
  }
  const hasEmailBeenChanged = data.email && user.email !== data.email;

  if (hasEmailBeenChanged) {
    data.emailVerified = null;
  }

  // check if we are changing email and identity provider is not CAL
  const hasEmailChangedOnNonCalProvider =
    hasEmailBeenChanged && user.identityProvider !== IdentityProvider.CAL;
  const hasEmailChangedOnCalProvider = hasEmailBeenChanged && user.identityProvider === IdentityProvider.CAL;

  if (hasEmailChangedOnNonCalProvider) {
    // Only validate if we're changing email
    data.identityProvider = IdentityProvider.CAL;
    data.identityProviderId = null;
  } else if (hasEmailChangedOnCalProvider) {
    // when the email changes, the user needs to sign in again.
    signOutUser = true;
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data,
    select: {
      id: true,
      avatar: true,
      username: true,
      email: true,
      identityProvider: true,
      identityProviderId: true,
      metadata: true,
      name: true,
      createdDate: true,
      bio: true,
      completedOnboarding: true,
      locale: true,
    },
  });

  // CUSTOM CODE
  if (process.env?.NEXT_PUBLIC_MENTO_COACH_URL && process.env?.NEXT_PUBLIC_CALENDAR_KEY) {
    try {
      const params = {
        name: updatedUser?.name,
        bio: updatedUser?.bio,
        avatar: updatedUser?.avatar,
      };

      if (!!updatedUser?.completedOnboarding) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        params["onboarded"] = updatedUser?.completedOnboarding;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        params["username"] = updatedUser?.username;
      }

      await fetch(`${process.env.NEXT_PUBLIC_MENTO_COACH_URL}/api/calendar/coach?email=${user?.email}`, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + process.env.NEXT_PUBLIC_CALENDAR_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
    } catch (e) {
      console.error(e);
    }
  }

  if (hasEmailChangedOnNonCalProvider) {
    // Because the email has changed, we are now attempting to use the CAL provider-
    // which has no password yet. We have to send the reset password email.
    await passwordResetRequest(updatedUser);
    signOutUser = true;
    passwordReset = true;
  }

  // Sync Services
  await syncServicesUpdateWebUser(updatedUser);

  // Notify stripe about the change
  if (updatedUser && updatedUser.metadata && hasKeyInMetadata(updatedUser, "stripeCustomerId")) {
    const stripeCustomerId = `${updatedUser.metadata.stripeCustomerId}`;
    await stripe.customers.update(stripeCustomerId, {
      metadata: {
        username: updatedUser.username,
        email: updatedUser.email,
        userId: updatedUser.id,
      },
    });
  }
  // Revalidate booking pages
  // Disabled because the booking pages are currently not using getStaticProps
  /*const res = ctx.res as NextApiResponse;
  if (typeof res?.revalidate !== "undefined") {
    const eventTypes = await prisma.eventType.findMany({
      where: {
        userId: user.id,
        team: null,
      },
      select: {
        id: true,
        slug: true,
      },
    });
    // waiting for this isn't needed
    Promise.all(
      eventTypes.map((eventType) => res?.revalidate(`/new-booker/${ctx.user.username}/${eventType.slug}`))
    )
      .then(() => console.info("Booking pages revalidated"))
      .catch((e) => console.error(e));
  }*/
  return { ...input, signOutUser, passwordReset };
};
