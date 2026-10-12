import type { GameMilestone } from "@ador/shared/games";

import { presentMilestone, reachedSummary } from "../domain/milestone-state.ts";

// The player's milestones for a game, each in the state the platform's records say. The summary is a polite
// live region, so a screen reader is told when the game reports a new one.
export function MilestoneList({
  milestones,
  unlocked,
}: {
  readonly milestones: readonly Pick<GameMilestone, "id" | "title">[];
  readonly unlocked: Readonly<Record<string, string>>;
}) {
  const views = milestones.map((milestone) =>
    presentMilestone(milestone, unlocked[milestone.id]),
  );
  return (
    <>
      <p aria-live="polite" data-testid="milestone-summary" role="status">
        {reachedSummary(views)}
      </p>
      <ul aria-label="Your milestones">
        {views.map((view) => (
          <li data-milestone={view.id} data-state={view.state} key={view.id}>
            <strong>{view.title}</strong> — <span>{view.label}</span>
            <p>{view.detail}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
