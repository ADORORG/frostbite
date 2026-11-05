import type { GameMilestone } from "@frostbite/shared/games";

import {
  presentMilestone,
  reachedSummary,
  type MilestoneView,
} from "../domain/milestone-state.ts";
import { MilestoneCard, type MilestoneClaiming } from "./milestone-card.tsx";
import type { MilestoneProgress } from "./use-game-session.ts";

export { replayCheckable } from "./milestone-card.tsx";

// A game's milestones, one card each. With the player's records (`unlocked`), each is in the state the platform's records say, the
// ones reached come first, and a polite live region tells a screen reader when the game reports a new one; with none (`null`: the game
// cannot be played here), they are only what the game declares, in the order it declared them.
export function MilestoneList({
  claim,
  milestones,
  progress,
  unlocked,
}: {
  // Present for a game whose milestones can be claimed: how each claim stands, and how to start or look at one.
  readonly claim?: MilestoneClaiming & { readonly message: string | null };
  readonly milestones: readonly GameMilestone[];
  // How often each was earned and the total toward each target, when the player's records say.
  readonly progress?: MilestoneProgress;
  readonly unlocked: Readonly<Record<string, string>> | null;
}) {
  const views: readonly MilestoneView[] | null =
    unlocked === null
      ? null
      : milestones.map((milestone) =>
          presentMilestone(milestone, unlocked[milestone.id], {
            count: progress?.counts[milestone.id],
            total: progress?.totals[milestone.id],
            verification: progress?.levels[milestone.id],
          }),
        );
  const cards = milestones
    .map((milestone, index) => ({ milestone, view: views?.[index] }))
    // Reached first; `sort` is stable, so each group keeps the game's own order.
    .sort(
      (a, b) =>
        Number(b.view?.state === "earned") - Number(a.view?.state === "earned"),
    );
  return (
    <>
      {views === null ? null : (
        <p aria-live="polite" data-testid="milestone-summary" role="status">
          {reachedSummary(views)}
        </p>
      )}
      {claim?.message == null ? null : <p role="alert">{claim.message}</p>}
      <ul aria-label="Milestones of this game" className="milestone-cards">
        {cards.map(({ milestone, view }) => (
          <li
            data-milestone={milestone.id}
            data-state={view?.state}
            key={milestone.id}
          >
            <MilestoneCard claiming={claim} milestone={milestone} view={view} />
          </li>
        ))}
      </ul>
    </>
  );
}
