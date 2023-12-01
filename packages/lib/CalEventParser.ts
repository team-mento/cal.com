import type { TFunction } from "next-i18next";
import short from "short-uuid";
import { v5 as uuidv5 } from "uuid";

import type { CalendarEvent } from "@calcom/types/Calendar";

import { WEBAPP_URL } from "./constants";
import getLabelValueMapFromResponses from "./getLabelValueMapFromResponses";

const translator = short();

// The odd indentation in this file is necessary because otherwise the leading tabs will be applied into the event description.

export const getWhat = (calEvent: CalendarEvent, t: TFunction) => {
  return `
${t("what")}:
${calEvent.type}
  `;
};

export const getWhen = (calEvent: CalendarEvent, t: TFunction) => {
  return calEvent.seatsPerTimeSlot
    ? `
${t("organizer_timezone")}:
${calEvent.organizer.timeZone}
  `
    : `
${t("invitee_timezone")}:
${calEvent.attendees[0].timeZone}
  `;
};

export const getWho = (calEvent: CalendarEvent, t: TFunction) => {
  let attendeesFromCalEvent = [...calEvent.attendees];
  if (calEvent.seatsPerTimeSlot && !calEvent.seatsShowAttendees) {
    attendeesFromCalEvent = [];
  }
  const attendees = attendeesFromCalEvent
    .map((attendee) => {
      return `
${attendee?.name || t("guest")}
${attendee.email}
      `;
    })
    .join("");

  const organizer = `
${calEvent.organizer.name} - ${t("organizer")}
${calEvent.organizer.email}
  `;

  const teamMembers = calEvent.team?.members
    ? calEvent.team.members.map((member) => {
        return `
${member.name} - ${t("team_member")}
${member.email}
    `;
      })
    : [];

  return `
${t("who")}:
${organizer + attendees + teamMembers.join("")}
  `;
};

export const getAdditionalNotes = (calEvent: CalendarEvent, t: TFunction) => {
  if (!calEvent.additionalNotes) {
    return "";
  }
  return `
${t("additional_notes")}:
${calEvent.additionalNotes}
  `;
};

export const getUserFieldsResponses = (calEvent: CalendarEvent) => {
  const labelValueMap = getLabelValueMapFromResponses(calEvent);

  if (!labelValueMap) {
    return "";
  }
  const responsesString = Object.keys(labelValueMap)
    .map((key) => {
      if (!labelValueMap) return "";
      if (labelValueMap[key] !== "") {
        return `
${key}:
${labelValueMap[key]}
  `;
      }
    })
    .join("");

  return responsesString;
};

export const getAppsStatus = (calEvent: CalendarEvent, t: TFunction) => {
  if (!calEvent.appsStatus) {
    return "";
  }
  return `\n${t("apps_status")}
      ${calEvent.appsStatus.map((app) => {
        return `\n- ${app.appName} ${
          app.success >= 1 ? `✅ ${app.success > 1 ? `(x${app.success})` : ""}` : ""
        }${
          app.warnings && app.warnings.length >= 1 ? app.warnings.map((warning) => `\n   - ${warning}`) : ""
        } ${app.failures && app.failures >= 1 ? `❌ ${app.failures > 1 ? `(x${app.failures})` : ""}` : ""} ${
          app.errors && app.errors.length >= 1 ? app.errors.map((error) => `\n   - ${error}`) : ""
        }`;
      })}
    `;
};

export const getDescription = (calEvent: CalendarEvent, t: TFunction) => {
  if (!calEvent.description) {
    return "";
  }
  return `\n${t("description")}
    ${calEvent.description}
    `;
};
export const getLocation = (calEvent: CalendarEvent) => {
  const meetingUrl = getVideoCallUrlFromCalEvent(calEvent);
  if (meetingUrl) {
    return meetingUrl;
  }
  const providerName = getProviderName(calEvent);
  return providerName || calEvent.location || "";
};

export const getProviderName = (calEvent: CalendarEvent): string => {
  // TODO: use getAppName from @calcom/app-store
  if (calEvent.location && calEvent.location.includes("integrations:")) {
    let location = calEvent.location.split(":")[1];
    if (location === "daily") {
      location = "Cal Video";
    }
    return location[0].toUpperCase() + location.slice(1);
  }
  // If location its a url, probably we should be validating it with a custom library
  if (calEvent.location && /^https?:\/\//.test(calEvent.location)) {
    return calEvent.location;
  }
  return "";
};

export const getUid = (calEvent: CalendarEvent): string => {
  const uid = calEvent.uid;
  return uid ?? translator.fromUUID(uuidv5(JSON.stringify(calEvent), uuidv5.URL));
};

const getSeatReferenceId = (calEvent: CalendarEvent): string => {
  return calEvent.attendeeSeatId ? calEvent.attendeeSeatId : "";
};

export const getManageLink = (calEvent: CalendarEvent, t: TFunction) => {
  return `${t("need_to_reschedule_or_cancel")}${calEvent.bookerUrl ?? WEBAPP_URL}/booking/${getUid(
    calEvent
  )}?changes=true`;
};

export const getCancelLink = (calEvent: CalendarEvent): string => {
  // const cancelLink = new URL((calEvent.bookerUrl ?? WEBAPP_URL) + `/booking/${getUid(calEvent)}`);
  // cancelLink.searchParams.append("cancel", "true");
  // cancelLink.searchParams.append("allRemainingBookings", String(!!calEvent.recurringEvent));
  // const seatReferenceUid = getSeatReferenceId(calEvent);
  // if (seatReferenceUid) cancelLink.searchParams.append("seatReferenceUid", seatReferenceUid);
  // return cancelLink.toString();
  return `${WEBAPP_URL}/booking/${getUid(calEvent)}?cancel=true`;
};

export const getRescheduleLink = (calEvent: CalendarEvent): string => {
  const Uid = getUid(calEvent);
  const seatUid = getSeatReferenceId(calEvent);

  return `${calEvent.bookerUrl ?? WEBAPP_URL}/reschedule/${seatUid ? seatUid : Uid}`;
};

const getMentoRedirectLink = (calEvent: CalendarEvent, action: string) => {
  const Uid = getUid(calEvent);
  return `${process.env.NEXT_PUBLIC_MENTO_WEB_URL}/sessions/external/${Uid}/${action}`;
};

const getGrowthPlanLink = (calEvent: CalendarEvent) => getMentoRedirectLink(calEvent, "growth");

const getSessionViewLink = (calEvent: CalendarEvent) => getMentoRedirectLink(calEvent, "view");

export const getRichDescription = (calEvent: CalendarEvent, t_?: TFunction /*, attendee?: Person*/) => {
  const appUrl = "https://app.mento.co";
  const cancelationPolicyURL =
    "https://mentoteam.notion.site/Mento-Rescheduling-Cancelation-Policy-ea6ed8fa23fc41a8a4598070ef42fb53";

  return `
${getCancellationReason(calEvent)}

🎥 <a href="${getLocation(calEvent)}" target="_blank">Join the session with Google Meet</a>

🗻 Get ready: <a href="${getGrowthPlanLink(
    calEvent
  )}" target="_blank">Review your Growth Plan</a> or <a href="${getSessionViewLink(
    calEvent
  )}" target="_blank">add a topic</a> you'd like to discuss.

📆 <a href="${getRescheduleLink(calEvent)}" target="_blank">Reschedule</a> or <a href="${getCancelLink(
    calEvent
  )}" target="_blank">cancel</a> on Mento 48 hours before the session start time.

Your coach will wait for up to 10 minutes for you before it’s considered a missed session. <a href="${cancelationPolicyURL}" target="_blank">Mento Rescheduling & Cancelation Policy</a>.

Manage coaching sessions on <a href="${appUrl}" target="_blank">Mento</a>`.trim();
};

export const getCancellationReason = (calEvent: CalendarEvent) => {
  if (!calEvent.cancellationReason) return "";
  return `
${calEvent.organizer.language.translate("cancellation_reason")}:
${calEvent.cancellationReason}
 `;
};

export const isDailyVideoCall = (calEvent: CalendarEvent): boolean => {
  return calEvent?.videoCallData?.type === "daily_video";
};

export const getPublicVideoCallUrl = (calEvent: CalendarEvent): string => {
  return `${WEBAPP_URL}/video/${getUid(calEvent)}`;
};

export const getVideoCallUrlFromCalEvent = (calEvent: CalendarEvent): string => {
  if (calEvent.videoCallData) {
    if (isDailyVideoCall(calEvent)) {
      return getPublicVideoCallUrl(calEvent);
    }
    return calEvent.videoCallData.url;
  }
  if (calEvent.additionalInformation?.hangoutLink) {
    return calEvent.additionalInformation.hangoutLink;
  }
  return "";
};

export const getVideoCallPassword = (calEvent: CalendarEvent): string => {
  return isDailyVideoCall(calEvent) ? "" : calEvent?.videoCallData?.password ?? "";
};
