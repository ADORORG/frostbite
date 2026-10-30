import { describe, expect, it } from "vitest";

import { maxMultiplier, subPerMetre } from "../src/rules/constants.ts";
import { over, tickOnce } from "../src/rules/tick.ts";
import type { Obstacle, RunState } from "../src/rules/types.ts";
import {
  bare,
  boulder,
  pit,
  press,
  roll,
  rock,
  spikes,
} from "./support/states.ts";

// Rolls on until the snowball is well past everything ahead, or the run is over.
function finish(state: RunState): RunState {
  let current = state;
  while (!over(current) && current.distance < 3_000)
    current = tickOnce(current);
  return current;
}

// What the snowball scores beyond the metres it has rolled.
const extra = (state: RunState): number =>
  state.score - Math.floor(state.distance / subPerMetre);

// A hop made `wait` ticks after the start and held for `hold`, over what is `ahead`.
function tryHop(
  ahead: readonly Obstacle[],
  wait: number,
  hold: number,
  changes?: Partial<RunState>,
): RunState {
  let state = bare({ ahead, ...changes });
  state = roll(state, wait);
  if (over(state)) return state;
  state = roll(press(state, true), hold);
  return over(state) ? state : finish(press(state, false));
}

const grid = (
  ahead: readonly Obstacle[],
  changes?: Partial<RunState>,
): RunState[] => {
  const found: RunState[] = [];
  for (let wait = 0; wait < 100; wait += 1)
    for (const hold of [1, 3, 6, 10, 20, 30])
      found.push(tryHop(ahead, wait, hold, changes));
  return found;
};

describe("a rock", () => {
  const ahead = [rock(700)];

  it("ends the run for a snowball that rolls into it", () => {
    const state = finish(bare({ ahead }));
    expect(state.alive).toBe(false);
    expect(state.cause).toBe("hit");
    expect(state.cleared.rock).toBe(0);
  });

  it("is cleared by a hop made in time, which scores ten", () => {
    const plain = grid(ahead).find(
      (state) =>
        state.alive && state.cleared.rock === 1 && state.closeCalls === 0,
    );
    expect(plain).toBeDefined();
    expect(extra(plain ?? bare())).toBe(10);
    expect(plain?.streak).toBe(0);
  });

  it("is cut fine by a hop that only just clears it, which scores more and starts a streak", () => {
    const close = grid(ahead).find(
      (state) => state.alive && state.closeCalls === 1,
    );
    expect(close).toBeDefined();
    expect(extra(close ?? bare())).toBe(50);
    expect([close?.streak, close?.bestStreak]).toEqual([1, 1]);
  });

  it("is hit by a hop made too early or too late, and cleared by only some of the hops in between", () => {
    const outcomes = grid(ahead);
    expect(outcomes.some((state) => !state.alive)).toBe(true);
    expect(
      outcomes.some((state) => state.alive && state.cleared.rock === 1),
    ).toBe(true);
    expect(
      outcomes.some((state) => state.alive && state.cleared.rock === 0),
    ).toBe(false);
  });

  it("is dropped from the course once it is behind", () => {
    const plain = grid(ahead).find(
      (state) => state.alive && state.cleared.rock === 1,
    );
    expect(plain?.ahead).toEqual([]);
  });
});

describe("the other obstacles", () => {
  it("needs a boulder to be cleared by a high hop: a short one is not enough", () => {
    const outcomes = grid([boulder(900)]);
    expect(
      outcomes.some((state) => state.alive && state.cleared.boulder === 1),
    ).toBe(true);
    const tap = tryHop([boulder(900)], 20, 1);
    expect(tap.alive).toBe(false);
  });

  it("lets even the lowest hop clear a row of spikes", () => {
    const outcomes = grid([spikes(900)]);
    expect(
      outcomes.filter((state) => state.alive && state.cleared.spikes === 1)
        .length,
    ).toBeGreaterThan(5);
  });

  it("counts a crevasse when the snowball has landed beyond it, and ends the run for one that falls in", () => {
    const ahead = [pit(700, 300)];
    expect(finish(bare({ ahead })).cause).toBe("fell");
    const crossed = grid(ahead).find(
      (state) => state.alive && state.cleared.pit === 1,
    );
    expect(crossed).toBeDefined();
    expect(crossed?.cleared.rock).toBe(0);
  });

  it("scores a crevasse cut fine, where the snowball lands within a few pixels of its far edge, as a close call", () => {
    const outcomes = grid([pit(700, 300)]);
    expect(
      outcomes.some(
        (state) =>
          state.alive && state.closeCalls === 1 && state.cleared.pit === 1,
      ),
    ).toBe(true);
    expect(
      outcomes.some(
        (state) =>
          state.alive && state.closeCalls === 0 && state.cleared.pit === 1,
      ),
    ).toBe(true);
  });
});

describe("a run of close calls", () => {
  const twoRocks = [rock(700), rock(1_500)];

  it("builds a streak, and each close call after the first scores more", () => {
    let best: RunState | undefined;
    for (let wait = 0; wait < 100 && best === undefined; wait += 1)
      for (let second = 0; second < 60 && best === undefined; second += 1)
        for (const hold of [2, 3, 4, 6]) {
          const steps: ((state: RunState) => RunState)[] = [
            (state) => roll(state, wait),
            (state) => roll(press(state, true), hold),
            (state) => roll(press(state, false), 40 + second),
            (state) => roll(press(state, true), hold),
            (state) => finish(press(state, false)),
          ];
          let state = bare({ ahead: twoRocks });
          for (const next of steps) {
            if (over(state)) break;
            state = next(state);
          }
          if (state.alive && state.bestStreak === 2) best = state;
        }
    expect(best).toBeDefined();
    expect(extra(best ?? bare())).toBe(50 + 75);
  });

  it("is ended by a plain clear, and the best streak is kept", () => {
    const close = grid([rock(700)]).find(
      (state) => state.closeCalls === 1 && state.alive,
    );
    expect(close).toBeDefined();
    const plain = grid([rock(700)], { bestStreak: 3, streak: 3 }).find(
      (state) =>
        state.alive && state.cleared.rock === 1 && state.closeCalls === 0,
    );
    expect(plain?.streak).toBe(0);
    expect(plain?.bestStreak).toBe(3);
  });

  it("multiplies what comes next by the streak, up to the most", () => {
    const close = grid([rock(700)], { streak: 40 }).find(
      (state) => state.alive && state.closeCalls === 1,
    );
    expect(extra(close ?? bare())).toBe(25 * maxMultiplier);
    const shard = finish(bare({ shards: [{ x: 600, y: 24 }], streak: 40 }));
    expect(extra(shard)).toBe(10 * maxMultiplier);
  });
});

describe("shards", () => {
  it("are taken as the snowball rolls through them, and scored by the streak", () => {
    const state = finish(bare({ shards: [{ x: 600, y: 24 }] }));
    expect(state.shardsTaken).toBe(1);
    expect(extra(state)).toBe(10);
    expect(state.shards).toEqual([]);
    const streaking = finish(bare({ shards: [{ x: 600, y: 24 }], streak: 2 }));
    expect(extra(streaking)).toBe(30);
  });

  it("are missed by a snowball too low or too high for them, and let go of once they are behind", () => {
    expect(finish(bare({ shards: [{ x: 600, y: 200 }] })).shardsTaken).toBe(0);
    const behind = finish(bare({ shards: [{ x: 600, y: 200 }] }));
    expect(behind.shards).toEqual([]);
    const high = tryHop([], 0, 30, { shards: [{ x: 300, y: 24 }] });
    expect(high.shardsTaken).toBe(0);
  });

  it("are taken in the air by a hop that goes through them", () => {
    let taken = 0;
    for (let wait = 0; wait < 50; wait += 1)
      taken = Math.max(
        taken,
        tryHop([], wait, 8, { shards: [{ x: 900, y: 120 }] }).shardsTaken,
      );
    expect(taken).toBe(1);
  });
});
