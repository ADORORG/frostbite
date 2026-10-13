import type { GameMilestone } from "@ador/shared/games";
import { ArcadeBadge } from "@repo/ui/arcade";

import { gameMilestonePolicyLabels } from "../domain/catalog.ts";
import { presentMilestone, reachedSummary } from "../domain/milestone-state.ts";
import type { MilestoneProgress } from "./use-game-session.ts";

// A game's milestones. With the player's records (`unlocked`), each is in the state the platform's records say and
// a polite live region tells a screen reader when the game reports a new one; with none (`null`: the game cannot
// be played here), they are only what the game declares. Either way each says how it is earned.
export function MilestoneList({
  milestones,
  progress,
  unlocked,
}: {
  readonly milestones: readonly GameMilestone[];
  // How often each was earned and the total toward each target, when the player's records say.
  readonly progress?: MilestoneProgress;
  readonly unlocked: Readonly<Record<string, string>> | null;
}) {
  const views =
    unlocked === null
      ? null
      : milestones.map((milestone) =>
          presentMilestone(milestone, unlocked[milestone.id], {
            count: progress?.counts[milestone.id],
            total: progress?.totals[milestone.id],
          }),
        );
  return (
    <>
      {views === null ? null : (
        <p aria-live="polite" data-testid="milestone-summary" role="status">
          {reachedSummary(views)}
        </p>
      )}
      <ul aria-label="Milestones of this game">
        {milestones.map((milestone, index) => {
          const view = views?.[index];
          return (
            <li
              data-milestone={milestone.id}
              data-state={view?.state}
              key={milestone.id}
            >
              <strong>{milestone.title}</strong>
              {view === undefined ? null : (
                <>
                  {" "}
                  — <span>{view.label}</span>
                </>
              )}{" "}
              <ArcadeBadge tone="yellow">
                {gameMilestonePolicyLabels[milestone.claimPolicy]}
              </ArcadeBadge>
              <br />
              <small>{`How it is earned: ${milestone.criteria}`}</small>
              {view?.state === "earned" ? (
                <>
                  <br />
                  <small>{view.detail}</small>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
