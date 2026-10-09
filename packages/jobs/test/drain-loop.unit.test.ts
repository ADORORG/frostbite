import { describe, expect, it } from "vitest";

import { runDrainLoop } from "../src/drain-loop.ts";
import {
  defaultMaintenanceLoopPolicy,
  drainLoopPolicySchema,
} from "../src/workflow-policy.ts";

const policy = { errorDelayMs: 500, idleDelayMs: 100 };

function harness(script: (number | Error | string)[], abortAfterSleeps = 99) {
  const controller = new AbortController();
  const sleeps: number[] = [];
  const errors: Error[] = [];
  let index = 0;
  return {
    errors,
    run: () =>
      runDrainLoop(
        {
          failureMessage: "Pass failed.",
          onError: (error) => errors.push(error),
          pass: async () => {
            const next = script[index];
            index += 1;
            if (next === undefined) {
              controller.abort();
              return 0;
            }
            if (typeof next === "string") throw next;
            if (next instanceof Error) throw next;
            return next;
          },
          signal: controller.signal,
          sleep: async (delayMs) => {
            sleeps.push(delayMs);
            if (sleeps.length >= abortAfterSleeps) controller.abort();
          },
        },
        policy,
      ),
    sleeps,
  };
}

describe("drain loop", () => {
  it("goes again at once after a pass that found work", async () => {
    const { run, sleeps } = harness([3, 1]);
    await run();
    expect(sleeps).toEqual([]);
  });

  it("waits the idle delay after a pass that found nothing", async () => {
    const { run, sleeps } = harness([0, 0], 2);
    await run();
    expect(sleeps).toEqual([100, 100]);
  });

  it("reports a failed pass, backs off, and keeps running", async () => {
    const { errors, run, sleeps } = harness([new Error("db down"), 1], 1);
    await run();
    expect(errors.map(({ message }) => message)).toEqual(["db down"]);
    expect(sleeps).toEqual([500]);
  });

  it("names a rejection that is not an Error with the supplied message", async () => {
    const { errors, run } = harness(["plain"], 1);
    await run();
    expect(errors.map(({ message }) => message)).toEqual(["Pass failed."]);
  });

  it("never starts when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let passes = 0;
    await runDrainLoop(
      {
        failureMessage: "x",
        onError: () => undefined,
        pass: async () => (passes += 1),
        signal: controller.signal,
        sleep: async () => undefined,
      },
      policy,
    );
    expect(passes).toBe(0);
  });

  it("rejects an invalid policy, and ships a valid slow maintenance default", async () => {
    await expect(
      runDrainLoop(
        {
          failureMessage: "x",
          onError: () => undefined,
          pass: async () => 0,
          signal: new AbortController().signal,
          sleep: async () => undefined,
        },
        { errorDelayMs: 0, idleDelayMs: 1 },
      ),
    ).rejects.toThrow();
    expect(drainLoopPolicySchema.parse(defaultMaintenanceLoopPolicy)).toEqual({
      errorDelayMs: 60_000,
      idleDelayMs: 300_000,
    });
    expect(Object.isFrozen(defaultMaintenanceLoopPolicy)).toBe(true);
  });
});
