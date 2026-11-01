import {
  aimHigh,
  aimLow,
  powerHigh,
  powerLow,
} from "../../src/rules/woods/constants.ts";
import { launchEgg, tickLaunch } from "../../src/rules/woods/launch.ts";
import type { WoodsState } from "../../src/rules/woods/types.ts";

// The launch round as a player who has done the sums plays it: for each egg, it tries the launcher at many tilts and powers on a copy
// of the round played through the real rules, and keeps the one that scores the most (the high star where it can).
export interface Shot {
  readonly aim: number;
  readonly power: number;
}

function scoreOf(state: WoodsState, aim: number, power: number): number {
  const { launch } = state;
  if (launch === null) return 0;
  let now = launchEgg({
    ...state,
    controls: {
      down: false,
      fire: false,
      left: false,
      right: false,
      up: false,
    },
    launch: { ...launch, aim, power },
  });
  for (let at = 0; at < 240 && now.launch?.flying !== null; at += 1)
    now = tickLaunch(now);
  return (now.launch?.score ?? 0) - launch.score;
}

export function bestShot(state: WoodsState): Shot {
  let best = {
    aim: state.launch?.aim ?? 128,
    power: state.launch?.power ?? 60,
    value: -1,
  };
  const tryShot = (aim: number, power: number): void => {
    if (aim < aimLow || aim > aimHigh || power < powerLow || power > powerHigh)
      return;
    const value = scoreOf(state, aim, power);
    if (value > best.value) best = { aim, power, value };
  };
  for (let aim = aimLow; aim <= aimHigh; aim += 6)
    for (let power = powerLow; power <= powerHigh; power += 3)
      tryShot(aim, power);
  const rough = best;
  for (let aim = rough.aim - 6; aim <= rough.aim + 6; aim += 2)
    for (let power = rough.power - 3; power <= rough.power + 3; power += 1)
      tryShot(aim, power);
  return best;
}
