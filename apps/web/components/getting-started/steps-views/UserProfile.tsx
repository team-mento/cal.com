import { useRouter } from "next/router";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { md } from "@calcom/lib/markdownIt";
import { telemetryEventTypes, useTelemetry } from "@calcom/lib/telemetry";
import turndown from "@calcom/lib/turndownService";
import { trpc } from "@calcom/trpc/react";
import { Avatar, Button, Editor, ImageUploader, Label, showToast } from "@calcom/ui";
import { ArrowRight } from "@calcom/ui/components/icon";

type FormData = {
  bio: string;
};

const UserProfile = () => {
  const [user] = trpc.viewer.me.useSuspenseQuery();
  const { t } = useLocale();
  const avatarRef = useRef<HTMLInputElement>(null);
  const { setValue, handleSubmit, getValues } = useForm<FormData>({
    defaultValues: { bio: user?.bio || "" },
  });

  const { data: eventTypes } = trpc.viewer.eventTypes.list.useQuery();
  const [imageSrc, setImageSrc] = useState<string>(user?.avatar || "");
  const utils = trpc.useContext();
  const router = useRouter();
  const createEventType = trpc.viewer.eventTypes.create.useMutation();
  const telemetry = useTelemetry();
  const [firstRender, setFirstRender] = useState(true);

  const mutation = trpc.viewer.updateProfile.useMutation({
    onSuccess: async (_data, context) => {
      if (context.avatar) {
        showToast(t("your_user_profile_updated_successfully"), "success");
        await utils.viewer.me.refetch();
      } else {
        try {
          if (eventTypes?.length === 0) {
            await Promise.all(
              DEFAULT_EVENT_TYPES.map(async (event) => {
                return createEventType.mutate(event);
              })
            );
          }
        } catch (error) {
          console.error(error);
        }

        await utils.viewer.me.refetch();
        router.push("/");
      }
    },
    onError: () => {
      showToast(t("problem_saving_user_profile"), "error");
    },
  });
  const onSubmit = handleSubmit((data: { bio: string }) => {
    const { bio } = data;

    telemetry.event(telemetryEventTypes.onboardingFinished);

    mutation.mutate({
      bio,
      completedOnboarding: true,
    });
  });

  async function updateProfileHandler(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const enteredAvatar = avatarRef.current?.value;
    mutation.mutate({
      avatar: enteredAvatar,
    });
  }

  const DEFAULT_EVENT_TYPES = [
    {
      title: "Start Bi-Weekly Coaching",
      slug: "bi-weekly-start-coaching-session",
      eventName: "{ATTENDEE} & {HOST} | Mento Bi-Weekly Coaching",
      description:
        "Choose a time that works for you every two weeks. You'll get the first invite right-away and a complete schedule confirmed soon after.",
      locations: [{ type: "integrations:google:meet" }],
      length: 45,
      hidden: true,
      afterEventBuffer: 15,
      minimumBookingNotice: 1440,
      slotInterval: 30,
    },
    {
      title: "Single Coaching Session",
      slug: "single-coaching-session",
      eventName: "{ATTENDEE} & {HOST} | Mento Coaching",
      description: "Use this to book one-time and make-up sessions when necessary.",
      locations: [{ type: "integrations:google:meet" }],
      length: 45,
      hidden: false,
      afterEventBuffer: 15,
      minimumBookingNotice: 1440,
      slotInterval: 30,
    },
    {
      title: "Setup Bi-Weekly Coaching",
      slug: "bi-weekly-coaching-session",
      eventName: "{ATTENDEE} & {HOST} | Mento Bi-Weekly Coaching",
      description: "Choose a time that works for you every two weeks for 45 minutes.",
      locations: [{ type: "integrations:google:meet" }],
      recurringEvent: { freq: 2, count: 16, interval: 2 },
      length: 45,
      hidden: false,
      afterEventBuffer: 15,
      minimumBookingNotice: 1440,
      slotInterval: 30,
    },
    {
      title: "Chemistry Call",
      slug: "chemistry-call",
      eventName: "{ATTENDEE} & {HOST} | Chemistry Call",
      description: "Please use this to book a chemistry call when meeting multiple coaches.",
      locations: [{ type: "integrations:google:meet" }],
      length: 30,
      hidden: false,
      afterEventBuffer: 15,
      minimumBookingNotice: 1440,
      slotInterval: 30,
    },
  ];

  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-row items-center justify-start rtl:justify-end">
        {user && (
          <Avatar
            alt={user.username || "user avatar"}
            gravatarFallbackMd5={user.emailMd5}
            size="lg"
            imageSrc={imageSrc}
          />
        )}
        <input
          ref={avatarRef}
          type="hidden"
          name="avatar"
          id="avatar"
          placeholder="URL"
          className="border-default focus:ring-empthasis mt-1 block w-full rounded-sm border px-3 py-2 text-sm focus:border-gray-800 focus:outline-none"
          defaultValue={imageSrc}
        />
        <div className="flex items-center px-4">
          <ImageUploader
            target="avatar"
            id="avatar-upload"
            buttonMsg={t("add_profile_photo")}
            handleAvatarChange={(newAvatar) => {
              if (avatarRef.current) {
                avatarRef.current.value = newAvatar;
              }
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                "value"
              )?.set;
              nativeInputValueSetter?.call(avatarRef.current, newAvatar);
              const ev2 = new Event("input", { bubbles: true });
              avatarRef.current?.dispatchEvent(ev2);
              updateProfileHandler(ev2 as unknown as FormEvent<HTMLFormElement>);
              setImageSrc(newAvatar);
            }}
            imageSrc={imageSrc}
          />
        </div>
      </div>
      <fieldset className="mt-8">
        <Label className="text-default mb-2 block text-sm font-medium">{t("about")}</Label>
        <Editor
          getText={() => md.render(getValues("bio") || user?.bio || "")}
          setText={(value: string) => setValue("bio", turndown(value))}
          excludedToolbarItems={["blockType", "bold", "italic", "link"]}
          firstRender={firstRender}
          setFirstRender={setFirstRender}
        />
        <p className="dark:text-inverted text-default mt-2 font-sans text-sm font-normal">
          {t("few_sentences_about_yourself")}
        </p>
      </fieldset>
      <Button
        type="submit"
        className="text-inverted mt-8 flex w-full flex-row justify-center rounded-md border border-black bg-black p-2 text-center text-sm">
        {t("finish")}
        <ArrowRight className="ml-2 h-4 w-4 self-center" aria-hidden="true" />
      </Button>
    </form>
  );
};

export default UserProfile;
