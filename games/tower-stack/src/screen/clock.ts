import { ticksIn as ticksInAt } from "@ador/game-sdk/fixed-step";

import { ticksPerSecond } from "../rules/constants.ts";

export { mostTicksAFrame } from "@ador/game-sdk/fixed-step";

// The screen runs on a timer and the rules know only ticks: this turns elapsed time into whole ticks at the game's rate.
export const ticksIn = (
  carried: number,
  elapsedMs: number,
): { readonly carried: number; readonly ticks: number } =>
  ticksInAt(carried, elapsedMs, ticksPerSecond);
