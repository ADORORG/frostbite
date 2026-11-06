import type { VerificationLevel } from "@frostbite/game-sdk/protocol";
import type { GameMilestone } from "@frostbite/shared/games";

// Where a milestone stands for a player. Only these two can be true today: the game reports a milestone, and
// nothing can be claimed on chain yet. When minting exists the claim states (pending, claimed, complete) are
// added here, so every page that shows a milestone gains them from this one place.
export const milestoneStates = ["not-earned", "earned"] as const;
export type MilestoneState = (typeof milestoneStates)[number];

// How an earned milestone is known, as the page says it: the game's own report, or a run the platform replayed.
export type MilestoneAssurance = "replay-checked" | "reported";

export interface MilestoneView {
  // Absent while not earned.
  readonly assurance?: MilestoneAssurance;
  readonly detail: string;
  readonly id: string;
  readonly label: string;
  readonly state: MilestoneState;
  readonly title: string;
}

// An earned milestone is the game's own report (the platform cannot see inside a game) unless the platform replayed a run
// that earned it, so it is described as reported, or as replay-checked and what that does and does not show, with the day,
// and with what it cannot yet do. Never "verified" alone, never "minted".
export function presentMilestone(
  milestone: Pick<GameMilestone, "id" | "maxCount" | "target" | "title">,
  unlockedAt: string | undefined,
  // How many times it was earned, and the total reported toward its target; absent when nothing is known.
  progress: {
    readonly count?: number;
    readonly total?: number;
    readonly verification?: VerificationLevel;
  } = {},
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
  const checked = progress.verification === "replay-verified";
  return {
    assurance: checked ? "replay-checked" : "reported",
    detail: checked
      ? `Replay-checked on ${unlockedAt.slice(0, 10)}: the platform replayed the run under the game's published rules, which shows the run followed them, not that a person played it. It cannot be minted yet.`
      : `Reported by the game on ${unlockedAt.slice(0, 10)}.${times} It cannot be minted yet.`,
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
