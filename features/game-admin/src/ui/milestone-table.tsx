import type { GameAdminStep } from "@ador/shared/games";
import {
  ArcadeActionButton,
  ArcadeInfoCard,
  ArcadeTextField,
} from "@repo/ui/arcade";
import { useState } from "react";

import type { AdminGameInfo } from "../game-info.ts";
import { stepCopy } from "../domain/copy.ts";

type Milestone = AdminGameInfo["milestones"][number];

const latestDefinition = (
  steps: readonly GameAdminStep[],
  milestoneId: string,
) =>
  [...steps]
    .reverse()
    .find(
      (step) =>
        step.operation === "define-milestone" &&
        step.summary.milestoneId === milestoneId,
    );

// Where a milestone stands on the contract, from the log: not defined, being defined, or defined.
function standing(
  steps: readonly GameAdminStep[],
  milestoneId: string,
): string {
  const step = latestDefinition(steps, milestoneId);
  if (step === undefined) return "Not defined";
  if (step.state === "complete") return "Defined";
  return stepCopy(step).label;
}

// The game's milestones with their claim limits (from the manifest) and a way to define each on the contract with its drawing. A
// milestone with no drawing gets the contract's generated picture. A milestone that is defined cannot be defined again.
export function MilestoneTable({
  busy,
  milestones,
  onDefine,
  steps,
}: {
  readonly busy: boolean;
  readonly milestones: readonly Milestone[];
  readonly onDefine: (milestoneId: string, drawing: string | undefined) => void;
  readonly steps: readonly GameAdminStep[];
}) {
  const [drawings, setDrawings] = useState<Readonly<Record<string, string>>>(
    {},
  );
  return (
    <ArcadeInfoCard title="Milestones">
      <ul aria-label="Milestones of this game">
        {milestones.map((milestone) => {
          const done =
            latestDefinition(steps, milestone.id)?.state === "complete";
          const drawing = drawings[milestone.id] ?? "";
          return (
            <li data-milestone={milestone.id} key={milestone.id}>
              <strong>{milestone.title}</strong> ({milestone.id}) — up to{" "}
              {milestone.claimLimit} claim
              {milestone.claimLimit === 1 ? "" : "s"} per wallet —{" "}
              <span>{standing(steps, milestone.id)}</span>
              {done ? null : (
                <>
                  <ArcadeTextField
                    hint="Optional SVG drawing. Without one the contract draws a generated picture."
                    label={`Drawing for ${milestone.title}`}
                    multiline
                    onChange={(value) =>
                      setDrawings((held) => ({
                        ...held,
                        [milestone.id]: value,
                      }))
                    }
                    value={drawing}
                  />
                  <ArcadeActionButton
                    disabled={busy}
                    onClick={() =>
                      onDefine(
                        milestone.id,
                        drawing.trim() === "" ? undefined : drawing,
                      )
                    }
                    tone="mint"
                  >
                    {`Define ${milestone.title}`}
                  </ArcadeActionButton>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </ArcadeInfoCard>
  );
}
