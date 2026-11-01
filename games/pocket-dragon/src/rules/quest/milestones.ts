import { swiftTicks } from "./constants.ts";
import type { LegRun } from "./legs.ts";
import { legEarned, legHearts, legHeartsLost } from "./legs.ts";
import type { QuestState } from "./types.ts";

// What the whole quest earns: every mark its levels earn on the way (the same as each level played alone), and the quest's own, decided
// by the run alone. The words are in the manifest; the list is a draft for the owner to approve.
export const legsOf = (state: QuestState): readonly LegRun[] => [
  ...state.past,
  state.leg,
];

export const questHeartsLost = (state: QuestState): number =>
  legsOf(state).reduce((lost, leg) => lost + legHeartsLost(leg), 0);

const won = (state: QuestState): boolean => state.finishTick !== null;

const marks: readonly (readonly [string, (state: QuestState) => boolean])[] = [
  ["quest-clear", won],
  ["quest-all-hearts", (s) => won(s) && questHeartsLost(s) === 0],
  ["quest-one-heart", (s) => won(s) && legHearts(s.leg) === 1],
  [
    "quest-swift",
    (s) => won(s) && (s.finishTick ?? swiftTicks + 1) <= swiftTicks,
  ],
];

export const questMilestones = marks.map(([id]) => id);

export function questEarned(state: QuestState): readonly string[] {
  const earned = new Set(legsOf(state).flatMap(legEarned));
  for (const [id, mark] of marks) if (mark(state)) earned.add(id);
  return [...earned];
}
