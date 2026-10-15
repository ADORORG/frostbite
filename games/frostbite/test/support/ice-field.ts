import type { JsonValue } from "@ador/game-sdk/protocol";

import {
  cells,
  defaultMines,
  iceFieldMines,
  iceFieldRules,
  type IceFieldState,
} from "../../src/verifier/ice-field.ts";

export type Config = Readonly<Record<string, JsonValue>>;

// Starts a run and applies inputs, failing the test if any is refused (unless it is the last and `expectRefusal`).
export function start(seed = 7, config: Config = {}): IceFieldState {
  const started = iceFieldRules.init(seed, config);
  if (!started.ok) throw new Error(started.reason);
  return started.state;
}
export const input = (type: string, data?: JsonValue) =>
  data === undefined ? { type } : { data, type };
export function apply(
  state: IceFieldState,
  ...inputs: ReturnType<typeof input>[]
) {
  let current = state;
  for (const next of inputs) {
    const stepped = iceFieldRules.step(current, next);
    if (!stepped.ok) throw new Error(stepped.reason);
    current = stepped.state;
  }
  return current;
}
export const refusal = (
  state: IceFieldState,
  next: ReturnType<typeof input>,
) => {
  const stepped = iceFieldRules.step(state, next);
  return stepped.ok ? null : stepped.reason;
};
export const safeTiles = (
  seed: number,
  board: number,
  mines = defaultMines,
) => {
  const mine = iceFieldMines(seed, board, mines);
  return Array.from({ length: cells }, (_, i) => i).filter(
    (i) => !mine.includes(i),
  );
};
