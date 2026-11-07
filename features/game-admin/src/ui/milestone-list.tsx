import type { GameAdminStep } from "@frostbite/shared/games";
import {
  ArcadeActionButton,
  ArcadeBadge,
  ArcadeTextField,
  SectionBlock,
} from "@repo/ui/arcade";
import { useState } from "react";

import type { AdminGameInfo } from "../game-info.ts";
import { stateTone, stepCopy } from "../domain/copy.ts";

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

// The game's milestones with their claim limits (from the manifest), where each stands on the contract (from the log), and a way to
// define each with its drawing. A milestone with no drawing gets the contract's generated picture. A milestone that is defined cannot
// be defined again.
export function MilestoneList({
  busy,
  milestones,
  onDefine,
  preparing,
  steps,
}: {
  readonly busy: boolean;
  readonly milestones: readonly Milestone[];
  readonly onDefine: (milestoneId: string, drawing: string | undefined) => void;
  // The milestone being defined now, if one is being prepared.
  readonly preparing: string | null;
  readonly steps: readonly GameAdminStep[];
}) {
  const [drawings, setDrawings] = useState<Readonly<Record<string, string>>>(
    {},
  );
  const defined = milestones.filter(
    (milestone) => latestDefinition(steps, milestone.id)?.state === "complete",
  ).length;
  return (
    <SectionBlock
      description={`Each is defined on the contract once, with a drawing that becomes the collectible. ${String(defined)} of ${String(milestones.length)} defined.`}
      title="Milestones"
    >
      <div
        aria-label="Milestones of this game"
        className="staff-scroll"
        role="region"
        tabIndex={0}
      >
        <ul className="milestones">
          {milestones.map((milestone) => {
            const step = latestDefinition(steps, milestone.id);
            const done = step?.state === "complete";
            const drawing = drawings[milestone.id] ?? "";
            return (
              <li data-milestone={milestone.id} key={milestone.id}>
                <div className="milestones__what">
                  <strong>{milestone.title}</strong>
                  <code>{milestone.id}</code>
                  <small>
                    {`Up to ${milestone.claimLimit} claim${milestone.claimLimit === 1 ? "" : "s"} per wallet`}
                  </small>
                </div>
                <ArcadeBadge
                  tone={
                    step === undefined
                      ? "yellow"
                      : done
                        ? "mint"
                        : stateTone[step.state]
                  }
                >
                  {step === undefined
                    ? "Not defined"
                    : done
                      ? "Defined"
                      : stepCopy(step).label}
                </ArcadeBadge>
                {done ? null : (
                  <div className="milestones__define">
                    <details>
                      <summary>Add a drawing (optional)</summary>
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
                    </details>
                    <ArcadeActionButton
                      ariaLabel={`Define ${milestone.title}`}
                      busy={preparing === milestone.id}
                      disabled={busy}
                      onClick={() =>
                        onDefine(
                          milestone.id,
                          drawing.trim() === "" ? undefined : drawing,
                        )
                      }
                      size="small"
                      tone="mint"
                    >
                      {preparing === milestone.id ? "Preparing…" : "Define"}
                    </ArcadeActionButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </SectionBlock>
  );
}
