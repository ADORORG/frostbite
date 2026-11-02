import {
  chestCount,
  clueCount,
  lanternCount,
  swiftTicks,
} from "./constants.ts";
import { sharedMarks } from "../shared-marks.ts";
import { chestsOpened, cluesRead, lanternsLit } from "./tick.ts";
import type { WoodsState } from "./types.ts";

// The marks a walk through the Whispering Woods earns, each decided by the state of the walk alone. The words are in the manifest; the
// list is a draft for the owner to approve. Every seed lays out every clue stone, chest and lantern where a walk can reach it, and the
// woods outside the maze are the same for every seed.
const all = (list: readonly boolean[] | undefined): boolean =>
  list !== undefined && list.every(Boolean);

// The marks of the three parts: the maze (its clues, treasure and way out), the woods outside it (every caged dragon freed) and DeFu's
// lair (her factory broken, her rocket defused).
const marks: readonly (readonly [string, (state: WoodsState) => boolean])[] = [
  ["woods-all-clues", (s) => cluesRead(s) >= clueCount],
  ["woods-chests-5", (s) => chestsOpened(s) >= chestCount],
  ["woods-lanterns", (s) => lanternsLit(s) >= lanternCount],
  ["woods-frozen-chest", (s) => s.moonChest],
  ["woods-escape", (s) => s.escaped],
  [
    "woods-swift",
    (s) => s.escaped && (s.escapeTick ?? swiftTicks + 1) <= swiftTicks,
  ],
  ["woods-launcher", (s) => s.parts.every(Boolean)],
  ["woods-allies", (s) => all(s.base?.allies)],
  ["woods-factory", (s) => all(s.base?.broken)],
  ["woods-defused", (s) => s.outcome === "defused"],
  ...sharedMarks<WoodsState>(
    (s) => s.charms.filter(Boolean).length,
    (s) => s.plasma.gathered,
  ),
];

export const woodsMilestones = marks.map(([id]) => id);

export const woodsEarned = (state: WoodsState): readonly string[] =>
  marks.filter(([, earned]) => earned(state)).map(([id]) => id);
