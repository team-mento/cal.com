import { SchedulingType } from "@prisma/client";
import { z } from "zod";

import * as imports from "../../zod-utils";

// TODO: figure out why EventTypeModel is being called even if it's not imported here, causing a circular dependency
// import { _EventTypeModel } from "../eventtype";

export const createEventTypeInput = z
  .object({
    title: z.string().min(1),
    slug: imports.eventTypeSlug,
    eventName: z.string().nullish(),
    description: z.string().nullish(),
    locations: imports.eventTypeLocations,
    recurringEvent: imports.recurringEventType?.optional(),
    length: z.number().int(),
    hidden: z.boolean(),
    teamId: z.number().int().nullish(),
    schedulingType: z.nativeEnum(SchedulingType).nullish(),
    afterEventBuffer: z.number().int(),
    minimumBookingNotice: z.number().int(),
    slotInterval: z.number().int().nullish(),
  })
  .partial({ hidden: true, locations: true })
  .refine((data) => (data.teamId ? data.teamId && data.schedulingType : true), {
    path: ["schedulingType"],
    message: "You must select a scheduling type for team events",
  });
