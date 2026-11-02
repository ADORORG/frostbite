import { levelAt, spiritMax, stepTicks, swiftStep } from "./constants.ts";
import type { CastleState } from "./types.ts";

// The guild grows like a party of adventurers: everything it does is experience, and experience is levels (one to ten). A higher level
// has more spirit in a cheer challenge and, every four levels, stronger shows; the gear found in the houses helps too (the swift boots
// step faster, the cheer cape makes every show stronger, the ember helm breathes fire farther).
const count = (list: readonly boolean[]): number => list.filter(Boolean).length;

export const friendsJoined = (state: CastleState): number =>
  count(state.friends);
export const eggsSaved = (state: CastleState): number =>
  state.eggs.filter((egg) => egg.state === "saved").length;
export const cluesRead = (state: CastleState): number => count(state.clues);
export const gearFound = (state: CastleState): number => count(state.gear);

export const xpOf = (state: CastleState): number =>
  100 * friendsJoined(state) +
  20 * count(state.taken) +
  80 * cluesRead(state) +
  60 * gearFound(state) +
  50 * eggsSaved(state) +
  150 * count(state.cheered) +
  20 * state.stuns +
  40 * count(state.charms);

export const levelOf = (xp: number): number =>
  levelAt.filter((at) => xp >= at).length;
export const guildLevel = (state: CastleState): number => levelOf(xpOf(state));

export const stepOf = (state: CastleState): number =>
  state.gear[0] === true ? swiftStep : stepTicks;
export const showBonus = (state: CastleState): number =>
  (state.gear[1] === true ? 1 : 0) + Math.floor((guildLevel(state) - 1) / 4);
export const spiritOf = (state: CastleState): number =>
  spiritMax + guildLevel(state) - 1;
