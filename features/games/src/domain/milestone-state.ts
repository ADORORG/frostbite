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
  milestone: Pick<GameMilestone, "id" | "maxCount" | "target" | "title">,
  unlockedAt: string | undefined,
  // How many times it was earned, and the total reported toward its target; absent when nothing is known.
  progress: { readonly count?: number; readonly total?: number } = {},
): MilestoneView {
  const { id, maxCount, target, title } = milestone;
  if (unlockedAt === undefined) {
    const total = progress.total ?? 0;
    return {
      detail:
        target !== undefined && total > 0
          ? `${String(total)} of ${String(target)} reported by the game so far.`
          : "Not reported by the game yet.",
      id,
      label:
        target !== undefined && total > 0
          ? `${String(total)} of ${String(target)}`
          : "Not yet",
      state: "not-earned",
      title,
    };
  }
  // Only a repeatable milestone has a count to show; one earned once is earned once, whatever a record says.
  const count = maxCount === undefined ? 1 : (progress.count ?? 1);
  // A repeatable milestone says how often it was reported, as far as the game's own limit lets it count.
  const times =
    maxCount !== undefined && count > 1
      ? ` Reported ${String(count)} times (counted up to ${String(maxCount)}).`
      : "";
  return {
    detail: `Reported by the game on ${unlockedAt.slice(0, 10)}.${times} It cannot be minted yet.`,
    id,
    label: count > 1 ? `Reached x${String(count)}` : "Reached",
    state: "earned",
    title,
  };
}

export function reachedSummary(views: readonly MilestoneView[]): string {
  const reached = views.filter(({ state }) => state === "earned").length;
  return `${String(reached)} of ${String(views.length)} reached`;
}
