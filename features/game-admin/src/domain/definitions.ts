import type { GameAdminStep } from "@frostbite/shared/games";

// The last step that set out to define this milestone, whatever became of it; none when it was never tried. Steps are in the order the
// log keeps them, oldest first.
export const latestDefinition = (
  steps: readonly GameAdminStep[],
  milestoneId: string,
): GameAdminStep | undefined =>
  [...steps]
    .reverse()
    .find(
      (step) =>
        step.operation === "define-milestone" &&
        step.summary.milestoneId === milestoneId,
    );

// Whether the contract has the milestone: its last definition completed. A milestone that is defined cannot be defined again.
export const isDefined = (
  steps: readonly GameAdminStep[],
  milestoneId: string,
): boolean => latestDefinition(steps, milestoneId)?.state === "complete";
