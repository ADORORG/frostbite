import type { Scene } from "../engine/index.ts";
import { blocks } from "./blocks.ts";
import { birds } from "./birds.ts";
import { breaker } from "./breaker.ts";
import { builder } from "./builder.ts";
import { hopper } from "./hopper.ts";
import { pong } from "./pong.ts";
import { racer } from "./racer.ts";
import { runner } from "./runner.ts";
import { shooter } from "./shooter.ts";
import { snake } from "./snake.ts";
import { street } from "./street.ts";

// The scenes the platform has, listed here and nowhere else: adding one is one import and one line. Nothing is found by scanning, and a
// repeated id is refused when the list is made.
export function defineScenes(list: readonly Scene[]): readonly Scene[] {
  const ids = new Set(list.map(({ id }) => id));
  if (ids.size !== list.length)
    throw new Error("Every scene has an id of its own.");
  return Object.freeze([...list]);
}

export const scenes = defineScenes([
  blocks,
  builder,
  shooter,
  birds,
  street,
  breaker,
  runner,
  racer,
  snake,
  pong,
  hopper,
]);
