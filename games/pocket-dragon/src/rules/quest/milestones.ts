import { eggsSaved } from "../castle/guild.ts";
import { nightEggs } from "../castle/places.ts";
import { stages } from "../hills/constants.ts";
import { swiftTicks } from "./constants.ts";
import type { ByLeg, LegRun } from "./legs.ts";
import {
  legEarned,
  legHearts,
  legHeartsLost,
  legShown,
  onLeg,
} from "./legs.ts";
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

// Every leg of the quest passes a test made for its level.
const everyLeg = (state: QuestState, test: ByLeg<boolean>): boolean =>
  legsOf(state).every((leg) => onLeg(legShown(leg), test));

// Every egg: Egg Hills' three golden eggs, all of the castle's night eggs saved, and all of the eggs in the woods' maze.
const allEggs: ByLeg<boolean> = {
  castle: (level) => eggsSaved(level) >= nightEggs.length,
  hills: (level) => level.goldens >= stages,
  woods: (level) => level.eggs.every(Boolean),
};
// Every secret area: the tunnel and the sky of each of Egg Hills' stages.
const allSecrets: ByLeg<boolean> = {
  castle: () => true,
  hills: (level) => level.secretsFound >= 2 * stages,
  woods: () => true,
};

const marks: readonly (readonly [string, (state: QuestState) => boolean])[] = [
  ["quest-clear", won],
  ["quest-all-hearts", (s) => won(s) && questHeartsLost(s) === 0],
  ["quest-one-heart", (s) => won(s) && legHearts(s.leg) === 1],
  [
    "quest-swift",
    (s) => won(s) && (s.finishTick ?? swiftTicks + 1) <= swiftTicks,
  ],
  ["quest-all-eggs", (s) => won(s) && everyLeg(s, allEggs)],
  ["quest-all-secrets", (s) => won(s) && everyLeg(s, allSecrets)],
];

export const questMilestones = marks.map(([id]) => id);

export function questEarned(state: QuestState): readonly string[] {
  const earned = new Set(legsOf(state).flatMap(legEarned));
  for (const [id, mark] of marks) if (mark(state)) earned.add(id);
  return [...earned];
}
