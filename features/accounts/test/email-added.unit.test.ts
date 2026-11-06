import { afterEach, describe, expect, it, vi } from "vitest";

import { addedOnText } from "../src/ui/email-added.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("when an address was added, in words", () => {
  it("says the day, with the month shortened", () => {
    expect(addedOnText("2026-10-20T08:30:00.000Z")).toBe("Added 20 Oct 2026");
    expect(addedOnText("2027-01-05T00:00:00.000Z")).toBe("Added 5 Jan 2027");
  });

  it("names the UTC day, whatever the reader's time zone, so the server and the browser draw the same text", async () => {
    // Fourteen hours ahead of UTC: half past eleven at night in UTC is already the afternoon of the next day there.
    vi.stubEnv("TZ", "Pacific/Kiritimati");
    vi.resetModules();
    const { addedOnText: inThatZone } =
      await import("../src/ui/email-added.ts");
    expect(new Date("2026-10-31T23:30:00.000Z").getDate()).toBe(1);
    expect(inThatZone("2026-10-31T23:30:00.000Z")).toBe("Added 31 Oct 2026");
    expect(inThatZone("2026-11-01T00:00:00.000Z")).toBe("Added 1 Nov 2026");
  });
});
