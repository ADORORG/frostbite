import { describe, expect, it, vi } from "vitest";

import { createRowSweepPass } from "../src/sweeps.ts";

const now = new Date("2026-11-04T12:00:00.000Z");
const counts = (
  walletChallenges: number,
  passkeyChallenges = 0,
  contactCodes = 0,
  deliveredOutboxEvents = 0,
  passkeySignInChallenges = 0,
) => ({
  contactCodes,
  deliveredOutboxEvents,
  passkeyChallenges,
  passkeySignInChallenges,
  walletChallenges,
});

describe("the row sweep pass", () => {
  it("asks for the removal as of the clock's time", async () => {
    const remove = vi.fn(async () => counts(0));
    await createRowSweepPass({
      clock: () => now,
      onResult: () => undefined,
      remove,
    })();
    expect(remove).toHaveBeenCalledWith(now);
  });

  it("reports the rows removed from every table together as its progress, so the loop goes again while there is more to remove", async () => {
    const pass = createRowSweepPass({
      clock: () => now,
      onResult: () => undefined,
      remove: async () => counts(1, 2, 4, 8, 16),
    });
    await expect(pass()).resolves.toBe(31);
  });

  it("hands the counts to the observer only when something was removed", async () => {
    const onResult = vi.fn();
    const quiet = createRowSweepPass({
      clock: () => now,
      onResult,
      remove: async () => counts(0),
    });
    await expect(quiet()).resolves.toBe(0);
    expect(onResult).not.toHaveBeenCalled();
    const busy = createRowSweepPass({
      clock: () => now,
      onResult,
      remove: async () => counts(0, 0, 3, 0),
    });
    await busy();
    expect(onResult).toHaveBeenCalledExactlyOnceWith(counts(0, 0, 3, 0));
  });

  it("lets a failed removal reach the loop, which reports it and backs off", async () => {
    const pass = createRowSweepPass({
      clock: () => now,
      onResult: () => undefined,
      remove: async () => {
        throw new Error("database is down");
      },
    });
    await expect(pass()).rejects.toThrow("database is down");
  });
});
