import type { GameState } from "@ador/shared/games";

// What a game's manifest says about one milestone that the account must hold it to.
export interface MilestoneRule {
  readonly claimPolicy: "once" | "repeatable";
  // The most a repeatable milestone is counted; absent for one earned once.
  readonly maxCount?: number;
  // The total at which a milestone earned once is earned; absent when the game reports it earned directly.
  readonly target?: number;
}

export type MilestoneRules = ReadonlyMap<string, MilestoneRule>;

// The most a milestone's count may be: once for one earned once, the manifest's maximum for a repeatable one.
const countCap = (rule: MilestoneRule): number =>
  rule.claimPolicy === "once" ? 1 : (rule.maxCount ?? 1);

// Brings a state within what the manifest allows, so the account never holds more than a game may claim: counts
// above the maximum and totals above the target are cut to it ("counts above it are ignored"). Ids the rules do not
// know are left alone; the caller has already refused them.
export function boundState(state: GameState, rules: MilestoneRules): GameState {
  return {
    ...state,
    counters: state.counters.map((counter) => {
      const target = rules.get(counter.id)?.target;
      return target === undefined
        ? counter
        : { ...counter, current: Math.min(counter.current, target) };
    }),
    milestones: state.milestones.map((record) => {
      const rule = rules.get(record.id);
      return rule === undefined
        ? record
        : { ...record, count: Math.min(record.count, countCap(rule)) };
    }),
  };
}

// A milestone whose total has reached its target is earned, whoever reported the total: the account, not the page,
// decides it, at the time the account first saw the total reach it.
export function earnReached(
  state: GameState,
  rules: MilestoneRules,
  now: Date,
): GameState {
  const earned = new Set(state.milestones.map(({ id }) => id));
  const reached = state.counters.filter(({ current, id }) => {
    const target = rules.get(id)?.target;
    return target !== undefined && current >= target && !earned.has(id);
  });
  if (reached.length === 0) return state;
  return {
    ...state,
    milestones: [
      ...state.milestones,
      ...reached.map(({ id }) => ({
        count: 1,
        id,
        unlockedAt: now.toISOString(),
        verification: "self-reported" as const,
      })),
    ].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
