import type { GameAdminStep } from "@frostbite/shared/games";
import { ArcadeBadge } from "@repo/ui/arcade";

import type { BatchRow } from "../domain/batch-drawings.ts";
import { batchCopy } from "../domain/batch-copy.ts";
import { latestDefinition } from "../domain/definitions.ts";
import { DefinitionBadge } from "./definition-badge.tsx";

const tone = {
  defined: "mint",
  missing: "yellow",
  ready: "cyan",
  refused: "red",
} as const;

// One line for each milestone of the batch: what was chosen for it and whether it passed, and once its step exists, how that step is
// getting on (the same badge the milestone list shows).
export function BatchRows({
  rows,
  steps,
}: {
  readonly rows: readonly BatchRow[];
  readonly steps: readonly GameAdminStep[];
}) {
  return (
    <ul className="milestones">
      {rows.map((row) => {
        const step = latestDefinition(steps, row.milestoneId);
        return (
          <li data-batch-state={row.state} key={row.milestoneId}>
            <div className="milestones__what">
              <strong>{row.title}</strong>
              <code>{row.milestoneId}</code>
              {row.state === "refused" ? (
                <small role="alert">{row.detail}</small>
              ) : null}
            </div>
            {step !== undefined && row.state !== "missing" ? (
              <DefinitionBadge step={step} />
            ) : (
              <ArcadeBadge tone={tone[row.state]}>
                {batchCopy.rowState[row.state]}
              </ArcadeBadge>
            )}
          </li>
        );
      })}
    </ul>
  );
}
