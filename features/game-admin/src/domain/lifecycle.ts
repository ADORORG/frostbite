import type { ProgressStep } from "@repo/ui/arcade";
import type { GameAdminStep } from "@ador/shared/games";

import { stepCopy } from "./copy.ts";

// The stages a step goes through, in order. A stage is "done" only when the platform's own record of the step says it is: built when
// it exists, signed and sent when the network has it, confirmed when it is in a block, indexed when the network's records show it.
const stages = ["Built", "Signed", "Sent", "Confirmed", "Indexed"] as const;

// How many stages a step in each waiting state has finished.
const finished = {
  "awaiting-signature": 1,
  confirmed: 4,
  pending: 3,
} as const;

// A step's life as stages with where each stands, from its state alone: nothing is claimed done that the record does not show. A step
// that failed or ran out of time stops after being built and says so, since the record does not say which stage it stopped at.
export function lifecycleSteps(
  step: Pick<GameAdminStep, "delayed" | "state" | "unconfirmedSend">,
): readonly ProgressStep[] {
  if (step.state === "failed" || step.state === "expired")
    return [
      { label: stages[0], state: "done" },
      {
        label: step.state === "failed" ? "Failed" : "Expired",
        state: "failed",
      },
    ];
  // Sent is done only when the network has been seen to hold the step; one the platform could not confirm is still being sent.
  const done =
    step.state === "complete"
      ? stages.length
      : step.unconfirmedSend && step.state === "pending"
        ? 2
        : finished[step.state];
  return stages.map((label, index): ProgressStep => {
    if (index < done) return { label, state: "done" };
    if (index === done)
      return { detail: stepCopy(step).label, label, state: "active" };
    return { label, state: "pending" };
  });
}
