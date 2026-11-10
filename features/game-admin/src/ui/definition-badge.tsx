import type { GameAdminStep } from "@frostbite/shared/games";
import { ArcadeBadge } from "@repo/ui/arcade";

import { stateTone, stepCopy } from "../domain/copy.ts";

// Where a milestone stands on the contract, from the last step that set out to define it: not defined, defined, or what its step is
// doing now. One badge for the milestone list and the batch of drawings, so they cannot say different things about one milestone.
export function DefinitionBadge({
  step,
}: {
  readonly step: GameAdminStep | undefined;
}) {
  const done = step?.state === "complete";
  return (
    <ArcadeBadge
      tone={
        step === undefined ? "yellow" : done ? "mint" : stateTone[step.state]
      }
    >
      {step === undefined
        ? "Not defined"
        : done
          ? "Defined"
          : stepCopy(step).label}
    </ArcadeBadge>
  );
}
