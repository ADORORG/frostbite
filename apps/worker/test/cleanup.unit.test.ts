import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import { createCleanupPass } from "../src/cleanup.ts";

const result = (claimed: number, removed: number) => ({
  claimed,
  failures: [],
  removed,
});

describe("cleanup pass", () => {
  it("reports what was removed as the progress, not what was claimed", async () => {
    const pass = createCleanupPass({
      onResult: () => undefined,
      sweep: async () => async () => result(3, 1),
    });
    await expect(pass()).resolves.toBe(1);
  });

  it("reports no progress when every removal failed, so the loop waits instead of hammering the store", async () => {
    const pass = createCleanupPass({
      onResult: () => undefined,
      sweep: async () => async () => ({
        claimed: 2,
        failures: [{ intentId: createUuidV7(), message: "down" }],
        removed: 0,
      }),
    });
    await expect(pass()).resolves.toBe(0);
  });

  it("hands the result to the observer only when something was claimed", async () => {
    const onResult = vi.fn();
    const idle = createCleanupPass({
      onResult,
      sweep: async () => async () => result(0, 0),
    });
    await idle();
    expect(onResult).not.toHaveBeenCalled();
    const busy = createCleanupPass({
      onResult,
      sweep: async () => async () => result(2, 2),
    });
    await busy();
    expect(onResult).toHaveBeenCalledExactlyOnceWith(result(2, 2));
  });

  it("asks for the sweep again on every pass", async () => {
    const sweep = vi.fn(async () => async () => result(0, 0));
    const pass = createCleanupPass({ onResult: () => undefined, sweep });
    await pass();
    await pass();
    expect(sweep).toHaveBeenCalledTimes(2);
  });

  it("lets a failure to compose or to sweep reach the loop", async () => {
    const unavailable = createCleanupPass({
      onResult: () => undefined,
      sweep: async () => {
        throw new Error("provider unavailable");
      },
    });
    await expect(unavailable()).rejects.toThrow("provider unavailable");
    const broken = createCleanupPass({
      onResult: () => undefined,
      sweep: async () => async () => {
        throw new Error("database down");
      },
    });
    await expect(broken()).rejects.toThrow("database down");
  });
});
