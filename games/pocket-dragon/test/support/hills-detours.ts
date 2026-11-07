import {
  heroHeight,
  heroWidth,
  tile,
} from "../../src/rules/hills/constants.ts";
import { sectionOf } from "../../src/rules/hills/secrets.ts";
import type { HillsState } from "../../src/rules/hills/types.ts";

// The way into a stage's secret areas and out again, for the Egg Hills bot: across the burrow it keeps to the ground and presses down
// on it; at the spring mushroom it keeps to the ground, lets the spring throw it up, and steers under the swirl cloud; and it goes
// through each area's far door. Null when none of them is near.
export interface Detour {
  readonly down: boolean;
  readonly jump: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

const run = { down: false, jump: false, left: false, right: true };

export function detour(state: HillsState): Detour | null {
  const { hero, level } = state;
  const section = sectionOf(hero.x);
  // Near a secret area's far door (the pipe at ground level, the rainbow over the last cloud), straight into it: going through takes
  // Glitchy back along the stage, which the bot would otherwise shy away from.
  if (section === "tunnel")
    return level.tunnelEnd.x - hero.x < 4 * tile ? run : null;
  if (section === "sky")
    return level.skyEnd.x - hero.x < 4 * tile
      ? { ...run, jump: hero.grounded }
      : null;
  const middle = hero.x + heroWidth / 2;
  if (!state.tunnelFound) {
    const { burrow } = level;
    const ahead = burrow.x + tile / 2 - middle;
    if (ahead > -tile / 2 && ahead < 3 * tile) {
      const over =
        hero.grounded &&
        middle >= burrow.x &&
        middle < burrow.x + tile &&
        hero.y + heroHeight === burrow.y;
      return { ...run, down: over };
    }
  }
  const spring = level.springs[0];
  if (!state.skyFound && spring !== undefined) {
    const gate = level.cloudGate.x + tile / 2 - middle;
    const ahead = spring.x + tile / 2 - middle;
    if (hero.sprung && !hero.grounded)
      return { ...run, left: gate < -tile / 8, right: gate > tile / 8 };
    if (ahead > -tile && ahead < 4 * tile) return run;
  }
  return null;
}
