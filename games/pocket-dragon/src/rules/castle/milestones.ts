import { swiftTicks } from "./constants.ts";
import { king } from "./places.ts";
import type { CastleState } from "./types.ts";

// The marks the guild's quest earns, each decided by the state of the run alone. The words are in the manifest; the list is a draft
// for the owner to approve.
export const friendsJoined = (state: CastleState): number =>
  state.friends.filter(Boolean).length;
const guardsCheered = (state: CastleState): number =>
  state.cheered.filter((done, at) => done && at !== king).length;

const marks: readonly (readonly [string, (state: CastleState) => boolean])[] = [
  ["guild-first-friend", (s) => friendsJoined(s) >= 1],
  ["guild-full", (s) => friendsJoined(s) >= s.friends.length],
  ["guild-river", (s) => s.crossedRiver],
  ["guild-escape", (s) => s.escapedWoods],
  ["guild-first-cheer", (s) => s.cheered.some(Boolean)],
  ["guild-guards", (s) => guardsCheered(s) >= 3],
  ["guild-castle", (s) => s.bannerRaised],
  ["guild-never-napped", (s) => s.bannerRaised && s.naps === 0],
  ["guild-favourite", (s) => s.perfectPicks >= 1],
  [
    "guild-swift",
    (s) => s.bannerRaised && (s.finishTick ?? swiftTicks + 1) <= swiftTicks,
  ],
];

export const castleMilestones = marks.map(([id]) => id);

export const castleEarned = (state: CastleState): readonly string[] =>
  marks.filter(([, earned]) => earned(state)).map(([id]) => id);
