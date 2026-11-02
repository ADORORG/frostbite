import { sharedMarks } from "../shared-marks.ts";
import { swiftTicks } from "./constants.ts";
import { friendsJoined } from "./guild.ts";
import { king } from "./places.ts";
import type { CastleState } from "./types.ts";

export { friendsJoined };

// The marks the guild's quest earns, each decided by the state of the run alone. The words are in the manifest; the list is a draft
// for the owner to approve.
const guardsCheered = (state: CastleState): number =>
  state.cheered.filter((done, at) => done && at !== king).length;

const marks: readonly (readonly [string, (state: CastleState) => boolean])[] = [
  ["guild-first-friend", (s) => friendsJoined(s) >= 1],
  ["guild-full", (s) => friendsJoined(s) >= s.friends.length],
  ["guild-river", (s) => s.crossedRiver],
  ["guild-escape", (s) => s.escapedWoods],
  ["guild-guards", (s) => guardsCheered(s) >= 3],
  ["guild-castle", (s) => s.goldenEgg],
  ["guild-never-napped", (s) => s.goldenEgg && s.naps === 0],
  ["guild-favourite", (s) => s.perfectPicks >= 1],
  [
    "guild-swift",
    (s) => s.goldenEgg && (s.finishTick ?? swiftTicks + 1) <= swiftTicks,
  ],
  ["guild-evade", (s) => s.evades >= 1],
  ["guild-charm", (s) => s.charmsUsed.some(Boolean)],
  // The masterful Pocket Dragon charm: the castle captured with the whole guild and every secret charm, never a nap, and every keeper
  // cheered up with its favourite show first.
  [
    "masterful-charm",
    (s) =>
      s.goldenEgg &&
      friendsJoined(s) >= s.friends.length &&
      s.charms.every(Boolean) &&
      s.naps === 0 &&
      s.perfectPicks >= s.cheered.length,
  ],
  ...sharedMarks<CastleState>(
    (s) => s.charms.filter(Boolean).length,
    (s) => s.plasma.gathered,
  ),
];

export const castleMilestones = marks.map(([id]) => id);

export const castleEarned = (state: CastleState): readonly string[] =>
  marks.filter(([, earned]) => earned(state)).map(([id]) => id);
