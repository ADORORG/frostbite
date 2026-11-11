import type { AdminChainPorts, StepChange, StoredStep } from "./types.ts";

// What a defined milestone says when the contract does not hold the drawing that was signed. A milestone is never edited, so this
// cannot be repaired by defining it again.
export const drawingNotHeld =
  "The milestone was defined, but the contract does not hold the drawing that was signed, so its collectibles will show a generated picture. A milestone cannot be defined again: define another milestone, or create the game's contract again.";

// Whether a confirmed definition did what staff were shown: the contract keeps exactly the drawing they signed. A definition with no
// drawing, and every other kind of step, has nothing to compare. Throws when the chain cannot be asked, so the step is looked at again
// later and is never completed on a guess.
export async function drawingProblem(
  step: StoredStep,
  chain: Pick<AdminChainPorts, "rewards">,
): Promise<StepChange | null> {
  const signed = step.unsigned.summary.drawing;
  if (
    step.operation !== "define-milestone" ||
    signed === undefined ||
    step.contract === null ||
    step.milestoneId === null
  )
    return null;
  const held = await chain.rewards.drawing(step.contract, step.milestoneId);
  return held?.sha256 === signed.sha256
    ? null
    : { failureReason: drawingNotHeld, state: "indexed_failure" };
}
