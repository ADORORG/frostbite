import { trackedStates, type TrackedState } from "@frostbite/shared/chain";
import { describe, expect, it } from "vitest";

import { stepsHoldAddress, type StepAddress } from "../src/plan.ts";

const step = (
  state: TrackedState,
  id: string | undefined,
  operation = "publish-template",
): StepAddress => ({
  operation,
  state,
  unsigned: { summary: { template: id === undefined ? {} : { at: { id } } } },
});

describe("whether a template step still holds its address", () => {
  it("does while it may yet put code there, and does not once it never will", () => {
    const freed: readonly TrackedState[] = [
      "broadcast_rejected",
      "expired",
      "indexed_failure",
    ];
    for (const state of trackedStates) {
      expect(stepsHoldAddress([step(state, "4:1000")], "4:1000"), state).toBe(
        !freed.includes(state),
      );
    }
  });

  it("is about that address and template steps only", () => {
    const steps = [
      step("awaiting_signature", "4:1001"),
      step("pending", undefined),
      step("pending", "4:1000", "deploy"),
    ];
    expect(stepsHoldAddress(steps, "4:1000")).toBe(false);
    expect(stepsHoldAddress(steps, "4:1001")).toBe(true);
    expect(stepsHoldAddress([], "4:1000")).toBe(false);
  });
});
