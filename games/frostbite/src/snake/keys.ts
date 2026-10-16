import type { Direction } from "../verifier/snake-board.ts";

// The keys that steer: the arrows and the letters the cabinet has always used. A map, so a key named like something every
// object has (`constructor`) is not read as a direction.
const keys = new Map<string, Direction>([
  ["ArrowDown", "down"],
  ["ArrowLeft", "left"],
  ["ArrowRight", "right"],
  ["ArrowUp", "up"],
  ["a", "left"],
  ["d", "right"],
  ["s", "down"],
  ["w", "up"],
]);

export const directionOfKey = (key: string): Direction | undefined =>
  keys.get(key) ?? keys.get(key.toLowerCase());
