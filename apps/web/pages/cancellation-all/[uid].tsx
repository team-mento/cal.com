import type { GetServerSidePropsContext } from "next";
import { z } from "zod";

import { maybeGetBookingUidFromSeat } from "@calcom/lib/server/maybeGetBookingUidFromSeat";
import prisma, { bookingMinimalSelect } from "@calcom/prisma";

export default function Type() {
  // Just redirect to the schedule page to reschedule it.
  return null;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { uid: bookingId } = z
    .object({ uid: z.string(), seatReferenceUid: z.string().optional() })
    .parse(context.query);
  const uid = await maybeGetBookingUidFromSeat(prisma, bookingId);

  const booking = await prisma.booking.findUnique({
    where: {
      uid,
    },
    select: {
      ...bookingMinimalSelect,
      eventType: {
        select: {
          users: {
            select: {
              username: true,
            },
          },
          slug: true,
          team: {
            select: {
              slug: true,
            },
          },
        },
      },
      dynamicEventSlugRef: true,
      dynamicGroupSlugRef: true,
      user: true,
    },
  });

  if (!booking) {
    return {
      notFound: true,
    } as const;
  }

  if (!booking?.eventType && !booking?.dynamicEventSlugRef) {
    // TODO: Show something in UI to let user know that this booking is not rescheduleable.
    return {
      notFound: true,
    } as {
      notFound: true;
    };
  }

  return {
    redirect: {
      destination: `/booking/${uid}?cancel=true&allRemainingBookings=true`,
      permanent: false,
    },
  };
}
