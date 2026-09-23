import { describe, expect, it } from "vitest";

import { schemaBookingCancelParams } from "@calcom/prisma/zod-utils";

describe("cancellation notification suppression", () => {
  it("schemaBookingCancelParams accepts suppressNotifications", () => {
    const parsed = schemaBookingCancelParams.parse({
      uid: "abc123",
      suppressNotifications: true,
    });
    expect(parsed.suppressNotifications).toBe(true);
  });

  it("schemaBookingCancelParams leaves suppressNotifications undefined when absent", () => {
    const parsed = schemaBookingCancelParams.parse({ uid: "abc123" });
    expect(parsed.suppressNotifications).toBeUndefined();
  });

  it("schemaBookingCancelParams rejects a non-boolean suppressNotifications", () => {
    expect(() => schemaBookingCancelParams.parse({ uid: "abc123", suppressNotifications: "yes" })).toThrow();
  });
});
