import type { Item, KitSpot } from "../kit.ts";
import {
  arenaTiles,
  levelTiles,
  pickupSize,
  pitRow,
  tile,
  wallRow,
} from "./constants.ts";
import { centred, type Layout } from "./layout.ts";

// Where the backpack's foods lie in a stage: three along the way, each a tile over flat ground, with nothing near it that hurts, throws
// or digs, never where an egg, the fire berry or a ledge is, and never in the boss's arena. Which comes first changes with the stage.
// They are laid out last, from the finished stage alone, so the rest of the stage is just as it would be without them.
const wanted = [44, 88, 124] as const;
const orders: readonly (readonly Item[])[] = [
  ["mushroom", "pineapple", "berry"],
  ["pineapple", "berry", "mushroom"],
  ["berry", "mushroom", "pineapple"],
];
const lookAhead = 36;

const columnOf = (x: number): number => Math.floor(x / tile);

function clear(layout: Layout, column: number, checkpoint: number): boolean {
  const top = layout.ground[column];
  if (top === undefined || top >= pitRow || top <= wallRow) return false;
  if (layout.ground[column - 1] !== top || layout.ground[column + 1] !== top)
    return false;
  if (layout.solid.has(column * 64 + top - 1)) return false;
  if (Math.abs(column - checkpoint) <= 2) return false;
  const near = (x: number, by: number): boolean =>
    Math.abs(columnOf(x) - column) <= by;
  const inRange = (from: number, to: number): boolean =>
    column >= columnOf(from) - 1 && column <= columnOf(to) + 2;
  return (
    !layout.ice.some((cell) => Math.abs(cell.column - column) <= 1) &&
    !layout.eggs.some((egg) => columnOf(egg.x) === column) &&
    ![...layout.thorns, ...layout.springs, ...layout.vents].some((spot) =>
      near(spot.x, 2),
    ) &&
    !(layout.burrow !== null && near(layout.burrow.x, 2)) &&
    !(layout.berry !== null && near(layout.berry.x, 1)) &&
    !layout.patrols.some((patrol) => inRange(patrol.minX, patrol.maxX)) &&
    !layout.rollers.some((roller) => inRange(roller.minX, roller.maxX))
  );
}

export function kitSpots(
  layout: Layout,
  checkpoint: number,
  stage: number,
): readonly KitSpot[] {
  const order = orders[(stage - 1) % orders.length] ?? [];
  const last = levelTiles - arenaTiles - 2;
  return order.flatMap((item, at) => {
    const from = wanted[at] ?? 0;
    const to = Math.min(from + lookAhead, last);
    for (let column = from; column < to; column += 1)
      if (clear(layout, column, checkpoint)) {
        const top = layout.ground[column] ?? 0;
        return [{ item, ...centred(column, top - 1, pickupSize) }];
      }
    return [];
  });
}
