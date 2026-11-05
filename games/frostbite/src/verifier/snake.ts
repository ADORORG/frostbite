import type { JsonValue } from "@frostbite/game-sdk/protocol";
import type {
  GameVerifier,
  RunInput,
  Stepped,
} from "@frostbite/game-sdk/run-record";

import {
  directions,
  foodGenerator,
  holds,
  isOpposite,
  nextHead,
  placeFood,
  placeMines,
  sameCell,
  startingHeading,
  startingSnake,
  type Cell,
  type Direction,
} from "./snake-board.ts";

// FROST·BITE's second replayable cabinet, SAT SNAKE: the real-time snake game, ported to a fixed-step simulation. The
// screen runs a timer; the rules know only ticks. Each tick the snake makes one move in the direction last chosen, and the
// run record holds what the player chose and on which tick. Between two choices the snake just keeps going, so the record
// is short and the same record always plays out the same way: the platform can replay it. Mines are drawn on the board for
// the player to see, so (unlike the ice field) nothing here is hidden from the browser.
//
// Inputs: `turn` `{ dir, tick }` points the snake from tick `tick` on; `end` `{ tick }` closes the run at that tick (a run
// that is not closed is not counted past its last choice, so the snake's last stretch needs it).

export const snakeCabinetName = "sat-snake";
// Moves a run may last: about 39 minutes at the screen's tick, and a bound on the work a replay does.
export const maxTicks = 10_000;
export const targetLength = 10;
export const snakeTen = "snake-ten";

export interface SnakeState {
  readonly alive: boolean;
  readonly ended: boolean;
  readonly food: Cell | null;
  readonly foodGenerator: number;
  readonly heading: Direction;
  readonly mines: readonly Cell[];
  readonly planned: Direction;
  readonly snake: readonly Cell[];
  readonly tick: number;
}

const refuse = (reason: string): { ok: false; reason: string } => ({
  ok: false,
  reason,
});

export function startSnake(seed: number): SnakeState {
  const mines = placeMines(seed);
  const food = placeFood(foodGenerator(seed), startingSnake, mines);
  return {
    alive: true,
    ended: false,
    food: food.cell,
    foodGenerator: food.generator,
    heading: startingHeading,
    mines,
    planned: startingHeading,
    snake: startingSnake,
    tick: 0,
  };
}

// One move. Striking the snake's own body (its tail cell included, as the game always played it) or a mine ends it.
export function moveOnce(state: SnakeState): SnakeState {
  if (!state.alive) return state;
  const [head] = state.snake;
  if (head === undefined) return { ...state, alive: false };
  const arrived = nextHead(head, state.planned);
  const base = { ...state, heading: state.planned, tick: state.tick + 1 };
  if (holds(state.snake, arrived) || holds(state.mines, arrived))
    return { ...base, alive: false };
  const ate = state.food !== null && sameCell(arrived, state.food);
  const snake = ate
    ? [arrived, ...state.snake]
    : [arrived, ...state.snake.slice(0, -1)];
  if (!ate) return { ...base, snake };
  const food = placeFood(state.foodGenerator, snake, state.mines);
  return { ...base, food: food.cell, foodGenerator: food.generator, snake };
}

// Lets the snake run on to `tick` (it stops where it dies).
export function advanceTo(state: SnakeState, tick: number): SnakeState {
  let current = state;
  while (current.alive && current.tick < tick) current = moveOnce(current);
  return current;
}

const isTick = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= maxTicks;
const isDirection = (value: unknown): value is Direction =>
  directions.some((direction) => direction === value);

const isObject = (
  data: JsonValue | undefined,
): data is Readonly<Record<string, JsonValue>> =>
  typeof data === "object" && data !== null && !Array.isArray(data);

// The fields of an input's data, which must be an object with exactly the named keys; or why it is not.
function fieldsOf(
  data: JsonValue | undefined,
  names: readonly string[],
): Readonly<Record<string, JsonValue>> | string {
  if (!isObject(data)) return "the input takes an object";
  const keys = Object.keys(data);
  return keys.length === names.length && names.every((n) => keys.includes(n))
    ? data
    : `the input takes exactly: ${names.join(", ")}`;
}

// The tick an input names, if it is a legal one to name now.
function tickOf(
  state: SnakeState,
  tick: JsonValue | undefined,
): number | string {
  if (!isTick(tick))
    return `tick must be a whole number from 0 to ${String(maxTicks)}`;
  return tick < state.tick ? `tick ${String(tick)} is already past` : tick;
}

function turn(
  state: SnakeState,
  data: JsonValue | undefined,
): Stepped<SnakeState> {
  const fields = fieldsOf(data, ["dir", "tick"]);
  if (typeof fields === "string") return refuse(fields);
  const tick = tickOf(state, fields.tick);
  if (typeof tick === "string") return refuse(tick);
  const { dir } = fields;
  if (!isDirection(dir))
    return refuse(`dir must be one of: ${directions.join(", ")}`);
  const moved = advanceTo(state, tick);
  if (!moved.alive)
    return refuse(`the snake died on tick ${String(moved.tick)}`);
  if (isOpposite(moved.heading, dir))
    return refuse("the snake cannot turn back on itself");
  return { ok: true, state: { ...moved, planned: dir } };
}

function end(
  state: SnakeState,
  data: JsonValue | undefined,
): Stepped<SnakeState> {
  const fields = fieldsOf(data, ["tick"]);
  if (typeof fields === "string") return refuse(fields);
  const tick = tickOf(state, fields.tick);
  if (typeof tick === "string") return refuse(tick);
  return { ok: true, state: { ...advanceTo(state, tick), ended: true } };
}

export const snakeRules: GameVerifier<SnakeState> = {
  earned: ({ snake }) => (snake.length >= targetLength ? [snakeTen] : []),
  id: snakeCabinetName,
  init(seed, config) {
    const [setting] = Object.keys(config);
    return setting === undefined
      ? { ok: true, state: startSnake(seed) }
      : refuse(`no such setting: ${setting}`);
  },
  step(state, input: RunInput) {
    if (state.ended) return refuse("the run has ended");
    switch (input.type) {
      case "turn":
        return turn(state, input.data);
      case "end":
        return end(state, input.data);
      default:
        return refuse(`no such input: ${input.type}`);
    }
  },
  version: 1,
};
