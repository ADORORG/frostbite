import { blockX } from "./block.ts";
import {
  baseWidth,
  byHairOverlap,
  fieldWidth,
  fiveStreak,
  growBy,
  growStreak,
  marathonTicks,
  needleHeight,
  needleWidth,
  perfectTolerance,
  tidyHeight,
  tidyPerfects,
  wideLoadHeight,
  wideLoadWidth,
} from "./constants.ts";
import { drawPhase } from "./state.ts";
import type { TowerState } from "./types.ts";

// What a drop on `tick` does to the tower. The moving block lands where it is on that tick: not over the tower at all, and the run is over;
// within `perfectTolerance` of it, and it snaps into place and loses nothing (and after a streak of perfect drops, grows back); otherwise
// it is trimmed to what overlaps the tower, and the next block is as wide as that.
export function dropAt(state: TowerState, tick: number): TowerState {
  const left = blockX(state, tick);
  const offset = Math.abs(left - state.topX);
  const overlap = state.width - offset;
  if (overlap <= 0) return { ...state, over: true, tick };
  const perfect = offset <= perfectTolerance;
  const grows =
    perfect && state.streak >= growStreak && state.width < baseWidth;
  const width = grows
    ? Math.min(baseWidth, state.width + growBy)
    : perfect
      ? state.width
      : overlap;
  const topX = perfect
    ? Math.max(
        0,
        Math.min(
          fieldWidth - width,
          state.topX - Math.floor((width - state.width) / 2),
        ),
      )
    : Math.max(left, state.topX);
  const streak = perfect ? state.streak + 1 : 0;
  const height = state.height + 1;
  const perfects = state.perfects + (perfect ? 1 : 0);
  const next = drawPhase(state.generator, width);
  return {
    ...state,
    bestStreak: Math.max(state.bestStreak, streak),
    byHair: state.byHair || (!perfect && overlap === byHairOverlap),
    fives: state.fives + (streak === fiveStreak ? 1 : 0),
    generator: next.generator,
    height,
    marathon: state.marathon || tick >= marathonTicks,
    needle: state.needle || (height >= needleHeight && width <= needleWidth),
    perfects,
    phase: next.phase,
    regrown: state.regrown || grows,
    startTick: tick,
    streak,
    tick,
    tidy: state.tidy || (height >= tidyHeight && perfects >= tidyPerfects),
    topX,
    wideLoad:
      state.wideLoad || (height >= wideLoadHeight && width >= wideLoadWidth),
    width,
  };
}
