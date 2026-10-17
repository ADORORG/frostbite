import { indexed, moveTo } from "@ador/shared/chain";

import type { Recording } from "@ador/database/game-contracts";
import type { StepChange, StoredStep } from "./types.ts";

// What a creation that confirmed but whose address could not be read says; it is how that failure is told from a reverted one, so
// staff can be offered the way to record the address by hand (`record.ts`).
export const unreadableCreation =
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

// A creation that confirmed on the chain but whose new address the platform could not read. A creation that reverted made nothing,
// so there is nothing to record for it.
export const isUnreadableCreation = (step: StoredStep): boolean =>
  step.operation === "deploy" &&
  step.state === "indexed_failure" &&
  step.failureReason === unreadableCreation;

// The change that completes a confirmed step, or null where the step is not confirmed.
export function completing(step: StoredStep): StepChange | null {
  const recording = recordingOf(step);
  const change: StepChange =
    recording === "unreadable"
      ? { failureReason: unreadableCreation, state: "indexed_failure" }
      : recording === null
        ? { state: indexed }
        : { record: recording, state: indexed };
  return moveTo("confirmed", change)(step);
}
