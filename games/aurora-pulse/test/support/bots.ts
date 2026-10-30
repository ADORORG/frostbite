import { stepInt } from "@ador/game-sdk/seeded";

import { maxTicks } from "../../src/rules/constants.ts";
import { hitOnce } from "../../src/rules/hit.ts";
import { startRun, stageAt, type PulseState } from "../../src/rules/state.ts";
import { tickOnce } from "../../src/rules/tick.ts";

// Players, to measure the game with. Each is a rule for when to tap each note: the perfect player taps every note exactly on its tick; the others
// tap a few ticks early or late, by an amount that is as wide as the player's `blur` plus a little more for each stage (a player tires and the
// charts get harder). A tap that lands outside `goodWindow` of its note is a stray and the note a miss.
export interface Tap {
  readonly lane: number;
  readonly tick: number;
}
export interface Result {
  readonly state: PulseState;
  readonly taps: readonly Tap[];
}

export function play(
  seed: number,
  blur: number,
  tiring = 0.35,
  limit = maxTicks,
): Result {
  let state = startRun(seed);
  let rng = (seed >>> 0) | 1;
  const spread = (): number => {
    let total = 0;
    for (let at = 0; at < 4; at += 1) {
      const stepped = stepInt(rng, 1_000);
      rng = stepped.state;
      total += stepped.value;
    }
    return (total - 2_000) / 1_000;
  };
  const planned = new Map<string, number>();
  const taps: Tap[] = [];
  while (!state.ended && state.tick < limit) {
    state = tickOnce(state);
    for (const note of state.pending) {
      const key = `${String(note.lane)}:${String(note.tick)}`;
      if (!planned.has(key))
        planned.set(
          key,
          note.tick +
            Math.round(
              spread() *
                1.73 *
                (blur + tiring * stageAt(note.tick) * (blur > 0 ? 1 : 0)),
            ),
        );
    }
    for (const note of [...state.pending]) {
      if (state.ended) break;
      if (
        planned.get(`${String(note.lane)}:${String(note.tick)}`) === state.tick
      ) {
        state = hitOnce(state, note.lane);
        taps.push({ lane: note.lane, tick: state.tick });
      }
    }
  }
  return { state, taps };
}
