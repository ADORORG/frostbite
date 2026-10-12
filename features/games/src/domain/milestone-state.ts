import type { GameMilestone } from "@ador/shared/games";

// Where a milestone stands for a player. Only these two can be true today: the game reports a milestone, and
// nothing can be claimed on chain yet. When minting exists the claim states (pending, claimed, complete) are
// added here, so every page that shows a milestone gains them from this one place.
export const milestoneStates = ["not-earned", "earned"] as const;
export type MilestoneState = (typeof milestoneStates)[number];

export interface MilestoneView {
  readonly detail: string;
  readonly id: string;
  readonly label: string;
  readonly state: MilestoneState;
  readonly title: string;
}

// An earned milestone is the game's own report (the platform cannot see inside a game), so it is described as
// reported, with the day, and with what it cannot yet do. Never "verified", never "minted".
export function presentMilestone(
  milestone: Pick<GameMilestone, "id" | "title">,
  unlockedAt: string | undefined,
): MilestoneView {
  const { id, title } = milestone;
  if (unlockedAt === undefined)
    return {
      detail: "Not reported by the game yet.",
      id,
      label: "Not yet",
      state: "not-earned",
      title,
    };
  return {
    detail: `Reported by the game on ${unlockedAt.slice(0, 10)}. It cannot be minted yet.`,
    id,
    label: "Reached",
    state: "earned",
    title,
  };
}

export function reachedSummary(views: readonly MilestoneView[]): string {
  const reached = views.filter(({ state }) => state === "earned").length;
  return `${String(reached)} of ${String(views.length)} reached`;
}
