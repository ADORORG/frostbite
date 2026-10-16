import type { JsonValue } from "@ador/game-sdk/protocol";
import { describe, expect, it } from "vitest";

import {
  holds,
  nextHead,
  type Cell,
  type Direction,
} from "../src/verifier/snake-board.ts";
import {
  advanceTo,
  maxTicks,
  moveOnce,
  snakeRules,
  snakeTen,
  startSnake,
  targetLength,
  type SnakeState,
} from "../src/verifier/snake.ts";

const seed = 1;
const fresh = () => startSnake(seed);
const step = (state: SnakeState, type: string, data?: JsonValue) => {
  const result = snakeRules.step(
    state,
    data === undefined ? { type } : { data, type },
  );
  if (!result.ok) throw new Error(result.reason);
  return result.state;
};
const refusal = (state: SnakeState, type: string, data?: JsonValue) => {
  const result = snakeRules.step(
    state,
    data === undefined ? { type } : { data, type },
  );
  return result.ok ? null : result.reason;
};
// The cell a snake at `head` heading `direction` would enter, as a state that has a mine or body there.
const withHead = (
  state: SnakeState,
  head: Cell,
  over: Partial<SnakeState>,
) => ({
  ...state,
  snake: [head, ...state.snake.slice(1)],
  ...over,
});

describe("starting a run", () => {
  it("is the same for the same seed and refuses any setting", () => {
    const started = snakeRules.init(seed, {});
    expect(started).toEqual({ ok: true, state: fresh() });
    expect(snakeRules.init(seed, { speed: 2 })).toEqual({
      ok: false,
      reason: "no such setting: speed",
    });
  });

  it("begins alive, three long, at tick 0, heading right, with food off the snake and the mines", () => {
    const state = fresh();
    expect(state).toMatchObject({ alive: true, ended: false, tick: 0 });
    expect(state.snake).toHaveLength(3);
    expect(state.heading).toBe("right");
    expect(state.planned).toBe("right");
    expect(state.food).not.toBeNull();
    if (state.food === null) return;
    expect(holds(state.snake, state.food)).toBe(false);
    expect(holds(state.mines, state.food)).toBe(false);
  });
});

describe("moving", () => {
  it("makes one move a tick in the chosen direction, the tail following", () => {
    const moved = moveOnce(fresh());
    expect(moved.tick).toBe(1);
    expect(moved.snake).toEqual([
      [7, 6],
      [6, 6],
      [5, 6],
    ]);
    expect(moved.heading).toBe("right");
  });

  it("runs on along a clear row, wrapping, without dying", () => {
    expect(advanceTo(fresh(), 40)).toMatchObject({ alive: true, tick: 40 });
  });

  it("grows by eating, takes new food off the snake and the mines, and uses the next draw", () => {
    const base = fresh();
    const head: Cell = [3, 3];
    const toward: Direction = "right";
    const food = nextHead(head, toward);
    const state = withHead(base, head, {
      food,
      mines: [],
      planned: toward,
      snake: [head, [2, 3], [1, 3]],
    });
    const ate = moveOnce(state);
    expect(ate.snake).toHaveLength(4);
    expect(ate.snake[0]).toEqual(food);
    expect(ate.food).not.toBeNull();
    expect(ate.foodGenerator).not.toBe(state.foodGenerator);
    if (ate.food !== null) expect(holds(ate.snake, ate.food)).toBe(false);
  });

  it("dies on a mine and stays dead", () => {
    const head: Cell = [3, 3];
    const state = {
      ...fresh(),
      mines: [nextHead(head, "right")],
      planned: "right" as const,
      snake: [head, [2, 3], [1, 3]] as readonly Cell[],
    };
    const dead = moveOnce(state);
    expect(dead.alive).toBe(false);
    expect(dead.tick).toBe(1);
    expect(dead.snake).toEqual(state.snake);
    expect(moveOnce(dead)).toBe(dead);
    expect(advanceTo(dead, 50).tick).toBe(1);
  });

  it("dies on its own body, the tail cell included", () => {
    const body: readonly Cell[] = [
      [3, 3],
      [3, 4],
      [4, 4],
      [4, 3],
    ];
    const bitten = moveOnce({
      ...fresh(),
      mines: [],
      planned: "right",
      snake: body,
    });
    expect(bitten.alive).toBe(false);
    const tail = moveOnce({
      ...fresh(),
      mines: [],
      planned: "up",
      snake: [
        [4, 4],
        [5, 4],
        [5, 3],
        [4, 3],
      ],
    });
    expect(tail.alive).toBe(false);
  });

  it("does not move a snake with no cells", () => {
    expect(moveOnce({ ...fresh(), snake: [] }).alive).toBe(false);
  });

  it("does not pick up food when there is none", () => {
    const state = { ...fresh(), food: null };
    expect(moveOnce(state).snake).toHaveLength(3);
  });
});

describe("turning", () => {
  it("points the snake from the named tick, moving it there first", () => {
    const turned = step(fresh(), "turn", { dir: "up", tick: 2 });
    expect(turned.tick).toBe(2);
    expect(turned.planned).toBe("up");
    expect(turned.heading).toBe("right");
    expect(moveOnce(turned).snake[0]).toEqual([8, 5]);
  });

  it("allows turning at the tick it is already on, and to the same direction", () => {
    const first = step(fresh(), "turn", { dir: "up", tick: 0 });
    expect(step(first, "turn", { dir: "up", tick: 0 }).planned).toBe("up");
  });

  it("refuses to turn back on the way the snake last moved, but not on a plan not yet moved", () => {
    expect(refusal(fresh(), "turn", { dir: "left", tick: 0 })).toBe(
      "the snake cannot turn back on itself",
    );
    const planned = step(fresh(), "turn", { dir: "up", tick: 0 });
    expect(refusal(planned, "turn", { dir: "left", tick: 0 })).toBe(
      "the snake cannot turn back on itself",
    );
    expect(step(planned, "turn", { dir: "down", tick: 0 }).planned).toBe(
      "down",
    );
  });

  it.each([
    ["no data", undefined, "the input takes an object"],
    ["a number", 3, "the input takes an object"],
    ["a list", [1, 2], "the input takes an object"],
    ["null", null, "the input takes an object"],
    ["a missing tick", { dir: "up" }, "the input takes exactly: dir, tick"],
    [
      "an extra field",
      { dir: "up", extra: 1, tick: 1 },
      "the input takes exactly: dir, tick",
    ],
    [
      "a fractional tick",
      { dir: "up", tick: 1.5 },
      `tick must be a whole number from 0 to ${String(maxTicks)}`,
    ],
    [
      "a negative tick",
      { dir: "up", tick: -1 },
      `tick must be a whole number from 0 to ${String(maxTicks)}`,
    ],
    [
      "a tick past the limit",
      { dir: "up", tick: maxTicks + 1 },
      `tick must be a whole number from 0 to ${String(maxTicks)}`,
    ],
    [
      "a text tick",
      { dir: "up", tick: "1" },
      `tick must be a whole number from 0 to ${String(maxTicks)}`,
    ],
    [
      "an unknown direction",
      { dir: "north", tick: 1 },
      "dir must be one of: down, left, right, up",
    ],
    [
      "a direction that is not text",
      { dir: 1, tick: 1 },
      "dir must be one of: down, left, right, up",
    ],
  ])("refuses %s", (_name, data, reason) => {
    expect(refusal(fresh(), "turn", data)).toBe(reason);
  });

  it("refuses a tick already past", () => {
    const later = step(fresh(), "turn", { dir: "up", tick: 3 });
    expect(refusal(later, "turn", { dir: "left", tick: 2 })).toBe(
      "tick 2 is already past",
    );
  });

  it("refuses a turn named for a tick after the snake died, saying when", () => {
    const state = {
      ...fresh(),
      mines: [nextHead([6, 6], "right")],
    };
    expect(refusal(state, "turn", { dir: "up", tick: 5 })).toBe(
      "the snake died on tick 1",
    );
  });
});

describe("ending", () => {
  it("lets the snake run on to the tick and then closes the run", () => {
    const ended = step(fresh(), "end", { tick: 6 });
    expect(ended).toMatchObject({ ended: true, tick: 6 });
    expect(refusal(ended, "turn", { dir: "up", tick: 6 })).toBe(
      "the run has ended",
    );
    expect(refusal(ended, "end", { tick: 6 })).toBe("the run has ended");
  });

  it("closes a run whose snake has died, at the tick it died", () => {
    const state = { ...fresh(), mines: [nextHead([6, 6], "right")] };
    expect(step(state, "end", { tick: 30 })).toMatchObject({
      alive: false,
      ended: true,
      tick: 1,
    });
  });

  it("takes only a tick, a whole one, not in the past", () => {
    expect(refusal(fresh(), "end", { dir: "up", tick: 1 })).toBe(
      "the input takes exactly: tick",
    );
    expect(refusal(fresh(), "end", { tick: -2 })).toBe(
      `tick must be a whole number from 0 to ${String(maxTicks)}`,
    );
    expect(refusal(step(fresh(), "end", { tick: 4 }), "end", { tick: 2 })).toBe(
      "the run has ended",
    );
    const moved = step(fresh(), "turn", { dir: "up", tick: 5 });
    expect(refusal(moved, "end", { tick: 3 })).toBe("tick 3 is already past");
    expect(refusal(fresh(), "end")).toBe("the input takes an object");
  });
});

describe("milestones", () => {
  it("earns snake-ten at the target length and not before", () => {
    const grown = (length: number): SnakeState => ({
      ...fresh(),
      snake: Array.from({ length }, (_, i): Cell => [i, 0]),
    });
    expect(snakeRules.earned(grown(targetLength - 1))).toEqual([]);
    expect(snakeRules.earned(grown(targetLength))).toEqual([snakeTen]);
    expect(snakeRules.earned(grown(targetLength + 5))).toEqual([snakeTen]);
  });

  it("refuses an input it does not know", () => {
    expect(refusal(fresh(), "jump")).toBe("no such input: jump");
  });
});
