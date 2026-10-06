import { describe, expect, it } from "vitest";

import { createIsolatedImageProcessor } from "../src/isolated-processor.ts";
import { encodeFrame } from "../src/protocol.ts";
import { parseRequest } from "../src/worker.ts";
import { fakeLauncher, fakeSchedule } from "./support/fakes.ts";

const policy = {
  maxDerivativeBytes: 1_000,
  wallTimeMs: 4_000,
  workerMaxHeapMegabytes: 256,
};
const input = {
  bytes: new Uint8Array([9, 8, 7]),
  derivatives: [
    { kind: "thumbnail", maxSide: 256 },
    { kind: "preview", maxSide: 1_024 },
  ],
  expected: { height: 5, width: 7 },
  limits: { maxDimension: 8_192, maxPixels: 40_000_000 },
  quality: 80,
} as const;
const success = encodeFrame(
  {
    derivatives: [
      { byteLength: 2, height: 10, kind: "thumbnail", width: 20 },
      { byteLength: 1, height: 30, kind: "preview", width: 40 },
    ],
    ok: true,
  },
  Buffer.from([1, 2, 3]),
);

function setup() {
  const launched = fakeLauncher();
  const timer = fakeSchedule();
  const processor = createIsolatedImageProcessor({
    launcher: launched.launcher,
    policy,
    schedule: timer.schedule,
  });
  const pending = processor.process(input);
  return { ...launched, pending, timer };
}

describe("isolated image processor orchestration", () => {
  it("launches a worker with the heap cap and sends the framed request", () => {
    const { launches, worker } = setup();
    expect(launches).toEqual([{ heapMegabytes: 256 }]);
    // The worker's own parser accepts exactly what the parent sent: a cross-contract check.
    const request = parseRequest(Buffer.from(worker.sent ?? new Uint8Array()));
    expect(request?.options).toEqual({
      derivatives: input.derivatives,
      expected: input.expected,
      limits: input.limits,
      quality: 80,
    });
    expect([...(request?.payload ?? [])]).toEqual([9, 8, 7]);
  });

  it("returns validated derivatives on a clean exit and cancels the timer", async () => {
    const { pending, timer, worker } = setup();
    worker.emitOutput(success.subarray(0, 10));
    worker.emitOutput(success.subarray(10));
    worker.emitExit(0);
    expect(await pending).toMatchObject({
      derivatives: [
        { height: 10, kind: "thumbnail", width: 20 },
        { height: 30, kind: "preview", width: 40 },
      ],
      ok: true,
    });
    expect(timer.state.delayMs).toBe(4_000);
    expect(timer.state.cancelled).toBe(true);
    expect(worker.killed).toBe(false);
  });

  it("passes a rejection from the worker through", async () => {
    const { pending, worker } = setup();
    worker.emitOutput(
      encodeFrame({ ok: false, reason: "decode-failed" }, Buffer.alloc(0)),
    );
    worker.emitExit(0);
    expect(await pending).toEqual({ ok: false, reason: "decode-failed" });
  });

  it("kills the worker when the wall time elapses and reports a limit violation", async () => {
    const { pending, timer, worker } = setup();
    timer.state.action?.();
    expect(worker.killed).toBe(true);
    worker.emitExit(null);
    expect(await pending).toEqual({
      ok: false,
      reason: "processing-limit-exceeded",
    });
  });

  it("kills the worker when output exceeds the cap, even if it later exits cleanly", async () => {
    const { pending, worker } = setup();
    worker.emitOutput(Buffer.alloc(2 * 1_000 + 65_536 + 1));
    expect(worker.killed).toBe(true);
    worker.emitExit(0);
    expect(await pending).toEqual({
      ok: false,
      reason: "processing-limit-exceeded",
    });
  });

  it("accepts output exactly at the cap", async () => {
    const { pending, worker } = setup();
    worker.emitOutput(Buffer.alloc(2 * 1_000 + 65_536));
    expect(worker.killed).toBe(false);
    worker.emitExit(0);
    await expect(pending).rejects.toThrow("invalid frame");
  });

  it.each([134, 137, null])(
    "reports exit %s, a crash or signal death, as a limit violation",
    async (code) => {
      const { pending, worker } = setup();
      worker.emitExit(code);
      expect(await pending).toEqual({
        ok: false,
        reason: "processing-limit-exceeded",
      });
    },
  );

  it.each([1, 2])(
    "rejects, retryably, when the worker exits with its own failure code %s",
    async (code) => {
      const { pending, worker } = setup();
      worker.emitExit(code);
      await expect(pending).rejects.toThrow(`Worker exited with code ${code}.`);
    },
  );

  it("rejects, retryably, when the worker cannot be started", async () => {
    const { pending, timer, worker } = setup();
    worker.emitFailure(new Error("spawn failed"));
    await expect(pending).rejects.toThrow("spawn failed");
    expect(timer.state.cancelled).toBe(true);
  });

  it("rejects when the worker sends an invalid or inconsistent reply", async () => {
    const invalid = setup();
    invalid.worker.emitOutput(Buffer.from("garbage"));
    invalid.worker.emitExit(0);
    await expect(invalid.pending).rejects.toThrow("invalid frame");
    const inconsistent = setup();
    inconsistent.worker.emitOutput(
      encodeFrame({ derivatives: [], ok: true }, Buffer.alloc(0)),
    );
    inconsistent.worker.emitExit(0);
    await expect(inconsistent.pending).rejects.toThrow("inconsistent");
  });

  it("uses the real timer by default and clears it on completion", async () => {
    const launched = fakeLauncher();
    const processor = createIsolatedImageProcessor({
      launcher: launched.launcher,
      policy,
    });
    const pending = processor.process(input);
    launched.worker.emitOutput(success);
    launched.worker.emitExit(0);
    expect(await pending).toMatchObject({ ok: true });
  });
});
