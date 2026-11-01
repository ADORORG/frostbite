import { maxTicks as castleTicks } from "../castle/constants.ts";
import { maxTicks as hillsTicks } from "../hills/constants.ts";
import { maxTicks as woodsTicks } from "../woods/constants.ts";

// The whole quest, played as one run: the three levels one after another, a shift into the next dimension between them, and one clock.
// Each level keeps its own time limit; the quest's is all of them together.
export const shiftTicks = 180;
export const maxTicks = hillsTicks + castleTicks + woodsTicks + 2 * shiftTicks;
// Won in ten minutes or less is swift.
export const swiftTicks = 36_000;
