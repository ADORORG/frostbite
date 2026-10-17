import { indexed, moveTo } from "@ador/shared/chain";

import type { Recording } from "@ador/database/game-contracts";
import type { StepChange, StoredStep } from "./types.ts";

const unreadable =
  "The step ran, but the chain did not report what it made, so the platform cannot record it.";

// What completing a confirmed step adds to the record of the chain: where a published template is, or where a game's contract was
// made. A step with nothing to record is just complete; one that should have made something and cannot say what failed to index.
function recordingOf(step: StoredStep): Recording | null | "unreadable" {
  const { summary } = step.unsigned;
  if (step.operation === "publish-template") {
    return step.templateRef === null || summary.template?.at === undefined
      ? "unreadable"
      : {
          address: summary.template.at.id,
          codeHash: summary.template.codeHash,
          kind: "template",
          templateRef: step.templateRef,
        };
  }
  if (step.operation === "deploy") {
    const address = step.createdContracts?.[0];
    return address === undefined ||
      step.gameId === null ||
      summary.maxDrawingBytes === undefined
      ? "unreadable"
      : {
          address,
          family: step.unsigned.family,
          gameId: step.gameId,
          kind: "game",
          maxDrawingBytes: summary.maxDrawingBytes,
        };
  }
  return null;
}

// The change that completes a confirmed step, or null where the step is not confirmed.
export function completing(step: StoredStep): StepChange | null {
  const recording = recordingOf(step);
  const change: StepChange =
    recording === "unreadable"
      ? { failureReason: unreadable, state: "indexed_failure" }
      : recording === null
        ? { state: indexed }
        : { record: recording, state: indexed };
  return moveTo("confirmed", change)(step);
}
