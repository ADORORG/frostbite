import { describe, expect, it } from "vitest";

import type { OutboxRelayResult } from "../src/outbox-relay.ts";
import { runOutboxRelayLoop } from "../src/relay-loop.ts";

const policy = { errorDelayMs: 500, idleDelayMs: 100 };
const batch = (claimed: number): OutboxRelayResult => ({
  claimed,
  delivered: claimed,
  failed: 0,
  retried: 0,
});

function harness(
  script: (OutboxRelayResult | Error)[],
  abortAfterSleeps?: number,
) {
  const controller = new AbortController();
  const sleeps: number[] = [];
  const errors: Error[] = [];
  let index = 0;
  return {
    errors,
    run: () =>
      runOutboxRelayLoop(
        {
          onError: (error) => errors.push(error),
          relay: async () => {
            const next = script[index];
            index += 1;
            if (next === undefined) {
              controller.abort();
              return batch(0);
            }
            if (next instanceof Error) throw next;
            return next;
          },
          signal: controller.signal,
          sleep: async (delayMs) => {
            sleeps.push(delayMs);
            if (
              abortAfterSleeps !== undefined &&
              sleeps.length >= abortAfterSleeps
            )
              controller.abort();
          },
        },
        policy,
      ),
    sleeps,
  };
}

describe("outbox relay loop", () => {
  it("runs the next batch immediately after one that claimed work", async () => {
    const { run, sleeps } = harness([batch(3), batch(2)]);
    await run();
    expect(sleeps).toEqual([]);
  });

  it("waits the idle delay after an empty batch", async () => {
    const { run, sleeps } = harness([batch(0), batch(0)], 2);
    await run();
    expect(sleeps).toEqual([100, 100]);
  });

  it("reports a failed batch, backs off, and keeps running", async () => {
    const { errors, run, sleeps } = harness(
      [new Error("database down"), batch(1)],
      1,
    );
    await run();
    expect(errors.map(({ message }) => message)).toEqual(["database down"]);
    expect(sleeps).toEqual([500]);
  });

  it("wraps a non-error rejection", async () => {
    const controller = new AbortController();
    const errors: Error[] = [];
    await runOutboxRelayLoop(
      {
        onError: (error) => errors.push(error),
        relay: async () => {
          controller.abort();
          throw "plain string";
        },
        signal: controller.signal,
        sleep: async () => undefined,
      },
      policy,
    );
    expect(errors.map(({ message }) => message)).toEqual(["Relay failed."]);
  });

  it("stops without sleeping when aborted during a batch, and never starts when already aborted", async () => {
    const controller = new AbortController();
    const sleeps: number[] = [];
    let batches = 0;
    await runOutboxRelayLoop(
      {
        onError: () => undefined,
        relay: async () => {
          batches += 1;
          controller.abort();
          return batch(0);
        },
        signal: controller.signal,
        sleep: async (delayMs) => void sleeps.push(delayMs),
      },
      policy,
    );
    expect([batches, sleeps]).toEqual([1, []]);
    await runOutboxRelayLoop(
      {
        onError: () => undefined,
        relay: async () => batch(0),
        signal: controller.signal,
        sleep: async () => undefined,
      },
      policy,
    );
    expect(batches).toBe(1);
  });

  it("rejects an invalid loop policy before running", async () => {
    await expect(
      runOutboxRelayLoop(
        {
          onError: () => undefined,
          relay: async () => batch(0),
          signal: new AbortController().signal,
          sleep: async () => undefined,
        },
        { errorDelayMs: 0, idleDelayMs: 100 },
      ),
    ).rejects.toThrow();
  });
});
