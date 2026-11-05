import { waitFor } from "@frostbite/test-kit/inngest-runtime";
import { describe, expect, it } from "vitest";

import {
  happy,
  maxConcurrentMediaRuns,
  retries,
  useRealRuntime,
} from "./support/runtime-harness.ts";

const harness = useRealRuntime();
// How long a media step takes in the concurrency test: long enough that runs the busy runtime starts a moment apart still overlap.
const mediaStepMs = 3_000;

describe("pipeline runs on the real Inngest runtime", () => {
  it("validates then processes a published event, as a completed run", async () => {
    harness.behave(happy);
    const event = harness.envelope("asset-happy");
    await harness.publisher().publish(event);
    await harness.api().waitForStatus(event.eventId, "Completed");
    expect(harness.callsFor("asset-happy")).toEqual(["validate", "process"]);
  }, 90_000);

  it("starts a single run when the same event id is delivered repeatedly", async () => {
    harness.behave(happy);
    const event = harness.envelope("asset-duplicate");
    await Promise.all([
      harness.publisher().publish(event),
      harness.publisher().publish(event),
      harness.publisher().publish(event),
    ]);
    await harness.api().waitForStatus(event.eventId, "Completed");
    await harness.quiet("asset-duplicate", 2_000);
    expect(await harness.api().runCount(event.eventId)).toBe(1);
    expect(harness.callsFor("asset-duplicate")).toEqual([
      "validate",
      "process",
    ]);
  }, 90_000);

  it("ends without processing when validation rejects the file", async () => {
    harness.behave({ ...happy, validate: async () => "rejected" });
    const event = harness.envelope("asset-rejected");
    await harness.publisher().publish(event);
    await harness.api().waitForStatus(event.eventId, "Completed");
    expect(harness.callsFor("asset-rejected")).toEqual(["validate"]);
  }, 90_000);

  it("fails a missing asset permanently without retrying", async () => {
    harness.behave({ ...happy, validate: async () => "unavailable" });
    const event = harness.envelope("asset-missing");
    await harness.publisher().publish(event);
    await waitFor(
      () => (harness.callsFor("asset-missing").length > 0 ? true : undefined),
      30_000,
      "the first call",
    );
    await harness.quiet("asset-missing");
    expect(harness.callsFor("asset-missing")).toEqual(["validate"]);
    expect(await harness.api().status(event.eventId)).toBe("Failed");
  }, 90_000);

  it("retries a transient failure and then completes", async () => {
    let attempts = 0;
    harness.behave({
      ...happy,
      validate: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("storage unavailable");
        return "validated";
      },
    });
    const event = harness.envelope("asset-transient");
    await harness.publisher().publish(event);
    await harness.api().waitForStatus(event.eventId, "Completed");
    await harness.quiet("asset-transient", 2_000);
    expect(harness.callsFor("asset-transient")).toEqual([
      "validate",
      "validate",
      "process",
    ]);
  }, 90_000);

  it("stops after the configured retries and reports a failed run", async () => {
    harness.behave({
      ...happy,
      validate: async () => {
        throw new Error("storage down");
      },
    });
    const event = harness.envelope("asset-exhausted");
    await harness.publisher().publish(event);
    // Waits for the last attempt itself, not for a quiet spell: the runtime's back-off between attempts can outlast any fixed quiet time
    // on a busy machine. The quiet spell after it then shows there is no attempt beyond the configured retries.
    await waitFor(
      () =>
        harness.callsFor("asset-exhausted").length >= retries + 1
          ? true
          : undefined,
      60_000,
      "every configured attempt",
    );
    await harness.quiet("asset-exhausted");
    expect(harness.callsFor("asset-exhausted")).toEqual(
      Array(retries + 1).fill("validate"),
    );
    expect(await harness.api().status(event.eventId)).toBe("Failed");
  }, 90_000);

  it("bounds how many media steps run at once", async () => {
    let active = 0;
    let peak = 0;
    const slow = async <Status>(status: Status): Promise<Status> => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, mediaStepMs));
      active -= 1;
      return status;
    };
    harness.behave({
      process: () => slow("processed"),
      validate: () => slow("validated"),
    });
    const events = ["a", "b", "c", "d"].map((suffix) =>
      harness.envelope(`asset-concurrent-${suffix}`),
    );
    await Promise.all(
      events.map((event) => harness.publisher().publish(event)),
    );
    for (const event of events)
      await harness.api().waitForStatus(event.eventId, "Completed");
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(maxConcurrentMediaRuns);
  }, 180_000);
});
