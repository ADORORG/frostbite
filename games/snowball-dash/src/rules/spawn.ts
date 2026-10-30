import { stepInt } from "@ador/game-sdk/seeded";

import { horizon, lastLevel } from "./constants.ts";
import { levelAt, speedAt } from "./course.ts";
import { patterns, type Draw } from "./patterns.ts";
import type { RunState } from "./types.ts";

// How long, in ticks of rolling, the snowball has between one pattern and the next: less as the level rises, down to `leastRecover`.
const recoverBase = 52;
const leastRecover = 34;
export const recoverTicks = (level: number): number =>
  Math.max(leastRecover, recoverBase - level);
const varietyTicks = (level: number): number =>
  Math.max(4, 24 - Math.floor(level / 2));

// Lays patterns until the course reaches `horizon` beyond `distance`. The generator's state is part of the run's, so the same seed always
// lays the same course, whenever the snowball gets there.
export function layAhead(state: RunState, distance: number): RunState {
  if (state.nextAt >= distance + horizon) return state;
  let { generator, nextAt } = state;
  const ahead = [...state.ahead];
  const shards = [...state.shards];
  const draw: Draw = (below) => {
    const next = stepInt(generator, below);
    generator = next.state;
    return next.value;
  };
  while (nextAt < distance + horizon) {
    const level = Math.min(levelAt(nextAt), lastLevel);
    const speed = speedAt(level);
    const eligible = patterns.filter(({ from }) => from <= level);
    let pick = draw(eligible.reduce((sum, { weight }) => sum + weight, 0));
    const chosen =
      eligible.find(({ weight }) => (pick -= weight) < 0) ?? eligible[0];
    if (chosen === undefined) break;
    const laid = chosen.lay(nextAt, speed, level, draw);
    ahead.push(...laid.obstacles);
    shards.push(...laid.shards);
    nextAt +=
      laid.length + speed * (recoverTicks(level) + draw(varietyTicks(level)));
  }
  return { ...state, ahead, generator, nextAt, shards };
}
