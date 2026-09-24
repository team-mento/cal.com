import prismaMock from "../../../../../tests/libs/__mocks__/prisma";

import { describe, expect, it, vi } from "vitest";

import { appStoreMetadata } from "@calcom/app-store/appStoreMetaData";
import {
  deleteScheduledEmailReminder,
  scheduleEmailReminder,
} from "@calcom/features/ee/workflows/lib/reminders/emailReminderManager";
import { cancelScheduledJobs } from "@calcom/features/webhooks/lib/scheduleTrigger";
import { BookingStatus, WorkflowActions, WorkflowMethods, WorkflowTriggerEvents } from "@calcom/prisma/enums";
import { schemaBookingCancelParams } from "@calcom/prisma/zod-utils";
import { test } from "@calcom/web/test/fixtures/fixtures";
import {
  createBookingScenario,
  getDate,
  getGoogleCalendarCredential,
  getOrganizer,
  getScenarioData,
  mockCalendar,
  TestData,
} from "@calcom/web/test/utils/bookingScenario/bookingScenario";

import { setupAndTeardown } from "../handleNewBooking/test/lib/setupAndTeardown";

vi.mock("@calcom/features/webhooks/lib/scheduleTrigger", () => ({
  cancelScheduledJobs: vi.fn(),
}));
vi.mock("@calcom/features/ee/workflows/lib/reminders/emailReminderManager", () => ({
  deleteScheduledEmailReminder: vi.fn(),
  scheduleEmailReminder: vi.fn(),
}));

async function createSeatedCancellationScenario({
  bookingUid,
  seatReferenceUid,
}: {
  bookingUid: string;
  seatReferenceUid: string;
}) {
  const organizer = getOrganizer({
    id: 101,
    name: "Organizer",
    email: "organizer@example.com",
    schedules: [TestData.schedules.IstWorkHours],
  });
  const attendeeEmail = "seat-attendee@example.com";
  const { dateString } = getDate({ dateIncrement: 1 });

  await createBookingScenario(
    getScenarioData({
      organizer,
      eventTypes: [{ id: 1, length: 45, seatsPerTimeSlot: 3, users: [{ id: organizer.id }] }],
      bookings: [
        {
          uid: bookingUid,
          userId: organizer.id,
          eventTypeId: 1,
          status: BookingStatus.ACCEPTED,
          startTime: `${dateString}T05:00:00.000Z`,
          endTime: `${dateString}T05:45:00.000Z`,
          attendees: [
            { email: attendeeEmail, name: "Seat Attendee", timeZone: "UTC" },
            { email: "other-attendee@example.com", name: "Other Attendee", timeZone: "UTC" },
          ],
        },
      ],
    })
  );

  const booking = await prismaMock.booking.findUniqueOrThrow({
    where: { uid: bookingUid },
    include: { attendees: true },
  });
  const attendee = booking.attendees.find(({ email }) => email === attendeeEmail);
  if (!attendee) throw new Error("Seated cancellation attendee was not created");

  await prismaMock.bookingSeat.create({
    data: {
      referenceUid: seatReferenceUid,
      bookingId: booking.id,
      attendeeId: attendee.id,
    },
  });

  return { attendeeEmail, organizer };
}

describe("cancellation notification suppression schema", () => {
  it("accepts suppressNotifications", () => {
    const parsed = schemaBookingCancelParams.parse({
      uid: "abc123",
      suppressNotifications: true,
    });
    expect(parsed.suppressNotifications).toBe(true);
  });

  it("leaves suppressNotifications undefined when absent", () => {
    const parsed = schemaBookingCancelParams.parse({ uid: "abc123" });
    expect(parsed.suppressNotifications).toBeUndefined();
  });

  it("rejects a non-boolean suppressNotifications", () => {
    expect(() => schemaBookingCancelParams.parse({ uid: "abc123", suppressNotifications: "yes" })).toThrow();
  });
});

describe("handleCancelBooking notification suppression", () => {
  setupAndTeardown();

  test("sends the attendee a cancellation email when notifications are not suppressed", async ({
    emails,
  }) => {
    const handleCancelBooking = (await import("../handleCancelBooking")).default;
    const organizer = getOrganizer({
      id: 101,
      name: "Organizer",
      email: "organizer@example.com",
      schedules: [TestData.schedules.IstWorkHours],
    });
    const attendeeEmail = "attendee@example.com";
    const bookingUid = "booking-with-cancellation-email";
    const { dateString } = getDate({ dateIncrement: 1 });

    await createBookingScenario(
      getScenarioData({
        organizer,
        eventTypes: [{ id: 1, length: 45, users: [{ id: organizer.id }] }],
        bookings: [
          {
            uid: bookingUid,
            userId: organizer.id,
            eventTypeId: 1,
            status: BookingStatus.ACCEPTED,
            startTime: `${dateString}T05:00:00.000Z`,
            endTime: `${dateString}T05:45:00.000Z`,
            attendees: [{ email: attendeeEmail, name: "Attendee", timeZone: "UTC" }],
          },
        ],
      })
    );

    await handleCancelBooking({
      body: { uid: bookingUid },
      userId: organizer.id,
    } as Parameters<typeof handleCancelBooking>[0]);

    expect(emails.get().some((email) => email.to.includes(attendeeEmail))).toBe(true);
  });

  test("sends the removed attendee a seated cancellation email by default", async ({ emails }) => {
    const handleCancelBooking = (await import("../handleCancelBooking")).default;
    const bookingUid = "seated-booking-with-cancellation-email";
    const seatReferenceUid = "seat-with-cancellation-email";
    const { attendeeEmail, organizer } = await createSeatedCancellationScenario({
      bookingUid,
      seatReferenceUid,
    });

    await handleCancelBooking({
      body: { uid: bookingUid, seatReferenceUid },
      userId: organizer.id,
    } as Parameters<typeof handleCancelBooking>[0]);

    expect(emails.get().some((email) => email.to.includes(attendeeEmail))).toBe(true);
  });

  test("suppresses the seated cancellation email when notifications are suppressed", async ({ emails }) => {
    const handleCancelBooking = (await import("../handleCancelBooking")).default;
    const bookingUid = "seated-booking-with-suppressed-cancellation-email";
    const seatReferenceUid = "seat-with-suppressed-cancellation-email";
    const { organizer } = await createSeatedCancellationScenario({ bookingUid, seatReferenceUid });

    await handleCancelBooking({
      body: { uid: bookingUid, seatReferenceUid, suppressNotifications: true },
      userId: organizer.id,
    } as Parameters<typeof handleCancelBooking>[0]);

    expect(emails.get()).toHaveLength(0);
  });

  test("suppresses cancellation notifications without suppressing cancellation cleanup", async ({
    emails,
  }) => {
    const handleCancelBooking = (await import("../handleCancelBooking")).default;
    vi.mocked(cancelScheduledJobs).mockClear();
    vi.mocked(deleteScheduledEmailReminder).mockClear();
    vi.mocked(scheduleEmailReminder).mockClear();
    const organizer = getOrganizer({
      id: 101,
      name: "Organizer",
      email: "organizer@example.com",
      schedules: [TestData.schedules.IstWorkHours],
      credentials: [getGoogleCalendarCredential()],
    });
    const attendeeEmail = "attendee@example.com";
    const bookingUid = "booking-with-suppressed-cancellation-email";
    const scheduledJob = "scheduled-job-1";
    const reminderId = 501;
    const reminderReferenceId = "workflow-reminder-1";
    const googleEventId = "google-event-1";
    const externalCalendarId = "organizer@example.com";
    const { dateString } = getDate({ dateIncrement: 1 });

    await createBookingScenario(
      getScenarioData({
        organizer,
        eventTypes: [{ id: 1, length: 45, users: [{ id: organizer.id }] }],
        bookings: [
          {
            uid: bookingUid,
            userId: organizer.id,
            eventTypeId: 1,
            status: BookingStatus.ACCEPTED,
            startTime: `${dateString}T05:00:00.000Z`,
            endTime: `${dateString}T05:45:00.000Z`,
            attendees: [{ email: attendeeEmail, name: "Attendee", timeZone: "UTC" }],
            references: [
              {
                type: appStoreMetadata.googlecalendar.type,
                uid: googleEventId,
                externalCalendarId,
              },
            ],
          },
        ],
        apps: [TestData.apps["google-calendar"]],
      })
    );
    await prismaMock.booking.update({
      where: { uid: bookingUid },
      data: { scheduledJobs: [scheduledJob] },
    });
    await prismaMock.workflowReminder.create({
      data: {
        id: reminderId,
        bookingUid,
        method: WorkflowMethods.EMAIL,
        scheduledDate: new Date(`${dateString}T04:00:00.000Z`),
        referenceId: reminderReferenceId,
        scheduled: true,
      },
    });
    const cancellationWorkflow = await prismaMock.workflow.create({
      data: {
        name: "Notify attendee when event is cancelled",
        trigger: WorkflowTriggerEvents.EVENT_CANCELLED,
        userId: organizer.id,
      },
    });
    await prismaMock.workflowStep.create({
      data: {
        stepNumber: 1,
        action: WorkflowActions.EMAIL_ATTENDEE,
        workflowId: cancellationWorkflow.id,
      },
    });
    await prismaMock.workflowsOnEventTypes.create({
      data: {
        workflowId: cancellationWorkflow.id,
        eventTypeId: 1,
      },
    });
    const calendarMock = mockCalendar("googlecalendar");

    await handleCancelBooking({
      body: { uid: bookingUid, suppressNotifications: true },
      userId: organizer.id,
    } as Parameters<typeof handleCancelBooking>[0]);

    expect(calendarMock.deleteEventCalls).toHaveLength(1);
    expect(calendarMock.deleteEventCalls[0]).toEqual([
      googleEventId,
      expect.objectContaining({ uid: bookingUid }),
      externalCalendarId,
    ]);
    expect(cancelScheduledJobs).toHaveBeenCalledWith(
      expect.objectContaining({ uid: bookingUid, scheduledJobs: [scheduledJob] })
    );
    expect(deleteScheduledEmailReminder).toHaveBeenCalledWith(reminderId, reminderReferenceId);
    expect(scheduleEmailReminder).not.toHaveBeenCalled();
    expect(emails.get()).toHaveLength(0);
  });
});
