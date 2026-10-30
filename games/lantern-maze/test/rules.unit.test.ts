import { describe, expect, it } from "vitest";

import { directions, lastFloor, maxMoves } from "../src/rules/constants.ts";
import { mazeRules } from "../src/rules/index.ts";
import { cellOpen, neighbour } from "../src/rules/maze.ts";
import { stepOnce } from "../src/rules/move.ts";
import { startRun, type MazeState } from "../src/rules/state.ts";
import { scout } from "./support/bots.ts";
import { withCounts } from "./support/states.ts";

const open = (state: MazeState): number =>
  [0, 1, 2, 3].find((d) => cellOpen(state.layout.maze, state.position, d)) ?? 0;
const walled = (state: MazeState): number =>
  [0, 1, 2, 3].find((d) => !cellOpen(state.layout.maze, state.position, d)) ??
  0;
const taken = (next: MazeState | string): MazeState => {
  if (typeof next === "string") throw new Error(next);
  return next;
};

describe("starting a run", () => {
  it("begins on the first floor with oil for two and a half times its shortest route, and the start lit", () => {
    const state = startRun(11);
    expect(state.floor).toBe(1);
    expect(state.position).toBe(0);
    expect(state.oil).toBe(Math.ceil((state.layout.shortest * 250) / 100));
    expect(state.peakOil).toBe(state.oil);
    expect(state.seen[0]).toBe(true);
    expect(state.seen.filter(Boolean).length).toBeGreaterThan(1);
    expect(state.seen.filter(Boolean).length).toBeLessThan(state.seen.length);
    expect(state.ended).toBe(false);
    expect(state.hasKey).toBe(false);
    expect(startRun(11)).toEqual(state);
  });
});

describe("a step", () => {
  it("moves one cell, burns one oil, lights what is near and counts the step", () => {
    const state = startRun(3);
    const direction = open(state);
    const next = taken(stepOnce(state, direction));
    expect(next.position).toBe(
      neighbour(
        state.layout.maze.width,
        state.layout.maze.height,
        0,
        direction,
      ),
    );
    expect(next.moves).toBe(1);
    expect(next.stepsHere).toBe(1);
    expect(next.oil).toBe(
      state.oil -
        1 +
        (state.flasks.includes(next.position) ? state.layout.flaskValue : 0),
    );
    expect(next.seen[next.position]).toBe(true);
  });

  it("is refused into a wall, with nothing changed", () => {
    const state = startRun(3);
    expect(stepOnce(state, walled(state))).toBe("a wall is there");
  });

  it("picks up a flask for its oil and points, once", () => {
    const base = startRun(4);
    const direction = open(base);
    const target = neighbour(
      base.layout.maze.width,
      base.layout.maze.height,
      0,
      direction,
    );
    const state = { ...base, flasks: [target, ...base.flasks] };
    const next = taken(stepOnce(state, direction));
    expect(next.flasksTaken).toBe(1);
    expect(next.flasks).not.toContain(target);
    expect(next.oil).toBe(state.oil - 1 + state.layout.flaskValue);
    expect(next.peakOil).toBe(next.oil);
    expect(next.score).toBe(25);
  });

  it("picks up the key, and keeps it", () => {
    const base = startRun(4);
    const direction = open(base);
    const target = neighbour(
      base.layout.maze.width,
      base.layout.maze.height,
      0,
      direction,
    );
    const elsewhere = base.layout.maze.open.length - 1;
    const state = {
      ...base,
      layout: { ...base.layout, door: elsewhere, key: target },
    };
    const next = taken(stepOnce(state, direction));
    expect(next.hasKey).toBe(true);
    const back = taken(stepOnce(next, (direction + 2) % 4));
    expect(back.hasKey).toBe(true);
  });

  it("does not open the door without the key, and ends the run in the dark when the last oil goes", () => {
    const base = startRun(4);
    const direction = open(base);
    const target = neighbour(
      base.layout.maze.width,
      base.layout.maze.height,
      0,
      direction,
    );
    const atDoor = { ...base, layout: { ...base.layout, door: target } };
    const stay = taken(stepOnce(atDoor, direction));
    expect(stay.floor).toBe(1);
    expect(stay.floorsCleared).toBe(0);
    const last = taken(stepOnce({ ...base, oil: 1 }, direction));
    expect(last.oil).toBe(0);
    expect(last.ended).toBe(true);
    expect(last.cause).toBe("dark");
  });

  it("clears the floor at the door with the key, even on the last oil, and brings the lantern to the next floor with its oil", () => {
    const base = startRun(4);
    const direction = open(base);
    const target = neighbour(
      base.layout.maze.width,
      base.layout.maze.height,
      0,
      direction,
    );
    const state = {
      ...base,
      hasKey: true,
      layout: { ...base.layout, door: target },
      oil: 1,
    };
    const next = taken(stepOnce(state, direction));
    expect(next.ended).toBe(false);
    expect(next.floor).toBe(2);
    expect(next.floorsCleared).toBe(1);
    expect(next.position).toBe(0);
    expect(next.hasKey).toBe(false);
    expect(next.stepsHere).toBe(0);
    expect(next.oil).toBe(next.layout.entry);
    expect(next.peakOil).toBe(Math.max(state.peakOil, next.oil));
    expect(next.score).toBe(
      100 + 4 * Math.max(0, 2 * state.layout.shortest - 1),
    );
    expect(next.seen.filter(Boolean).length).toBeGreaterThan(0);
  });

  it("counts lean, flawless and full-sweep floors, and the run of lean ones", () => {
    const base = startRun(4);
    const direction = open(base);
    const target = neighbour(
      base.layout.maze.width,
      base.layout.maze.height,
      0,
      direction,
    );
    const door = { ...base.layout, door: target };
    const lean = taken(
      stepOnce(
        {
          ...base,
          flasks: [],
          hasKey: true,
          layout: { ...door, shortest: 1 },
          stepsHere: 0,
        },
        direction,
      ),
    );
    expect([
      lean.lean,
      lean.flawless,
      lean.fullFloors,
      lean.leanStreak,
      lean.bestLeanStreak,
    ]).toEqual([1, 1, 1, 1, 1]);
    const exact = {
      ...base,
      flasks: [],
      hasKey: true,
      layout: { ...door, shortest: 10 },
      stepsHere: 12,
    };
    const limit = taken(stepOnce(exact, direction));
    expect([limit.lean, limit.flawless]).toEqual([1, 0]);
    const over = taken(
      stepOnce(
        { ...exact, stepsHere: 13, leanStreak: 3, bestLeanStreak: 3 },
        direction,
      ),
    );
    expect([over.lean, over.leanStreak, over.bestLeanStreak]).toEqual([
      0, 0, 3,
    ]);
    const left = taken(
      stepOnce({ ...exact, flasks: [base.layout.key] }, direction),
    );
    expect(left.fullFloors).toBe(0);
  });

  it("escapes on clearing the last floor", () => {
    const base = startRun(4);
    const direction = open(base);
    const target = neighbour(
      base.layout.maze.width,
      base.layout.maze.height,
      0,
      direction,
    );
    const state = {
      ...base,
      floor: lastFloor,
      hasKey: true,
      layout: { ...base.layout, door: target },
    };
    const next = taken(stepOnce(state, direction));
    expect(next.cause).toBe("escaped");
    expect(next.ended).toBe(true);
    expect(next.floorsCleared).toBe(1);
    expect(next.floor).toBe(lastFloor);
  });

  it("stops at the most steps a record can hold", () => {
    const base = startRun(4);
    const direction = open(base);
    const almost = { ...base, moves: maxMoves - 1, oil: 50 };
    const last = taken(stepOnce(almost, direction));
    expect(last.cause).toBe("spent");
    expect(last.ended).toBe(true);
    expect(stepOnce({ ...base, moves: maxMoves }, direction)).toBe(
      "the run has made the most moves it may",
    );
  });
});

describe("the rules as the platform replays them", () => {
  const init = (seed: number): MazeState => {
    const made = mazeRules.init(seed, {});
    if (!made.ok) throw new Error(made.reason);
    return made.state;
  };

  it("start from a seed with no settings, and refuse any setting", () => {
    expect(init(5)).toEqual(startRun(5));
    expect(mazeRules.init(5, { rows: 3 })).toEqual({
      ok: false,
      reason: "no such setting: rows",
    });
    expect(mazeRules.id).toBe("lantern-maze");
    expect(mazeRules.version).toBe(1);
  });

  it("take a step by name and refuse a wall, a name it does not know, data, and anything after the end", () => {
    const state = init(5);
    const name = directions[open(state)] ?? "up";
    const moved = mazeRules.step(state, { type: name });
    expect(moved.ok && moved.state.moves).toBe(1);
    expect(
      mazeRules.step(state, { type: directions[walled(state)] ?? "up" }),
    ).toEqual({ ok: false, reason: "a wall is there" });
    expect(mazeRules.step(state, { type: "jump" })).toEqual({
      ok: false,
      reason: "no such input: jump",
    });
    expect(mazeRules.step(state, { data: {}, type: name })).toEqual({
      ok: false,
      reason: "a step takes no data",
    });
    const ended = mazeRules.step(state, { type: "end" });
    expect(ended.ok && ended.state.ended).toBe(true);
    expect(mazeRules.step({ ...state, ended: true }, { type: name })).toEqual({
      ok: false,
      reason: "the run has ended",
    });
  });

  it("replay a whole escape to the milestones the state holds", () => {
    const { state, steps } = scout(31);
    expect(state.cause).toBe("escaped");
    let at = init(31);
    for (const step of steps) {
      const stepped = mazeRules.step(at, { type: directions[step] ?? "up" });
      if (!stepped.ok) throw new Error(stepped.reason);
      at = stepped.state;
    }
    expect(at).toEqual(state);
    expect(mazeRules.earned(at)).toContain("floors-30");
    expect(withCounts({}).ended).toBe(false);
  });
});
