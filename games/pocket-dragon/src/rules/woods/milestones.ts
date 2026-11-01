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
// list is a draft for the owner to approve. Every seed lays out every clue stone, chest and lantern where a walk can reach it.
const marks: readonly (readonly [string, (state: WoodsState) => boolean])[] = [
  ["woods-first-clue", (s) => cluesRead(s) >= 1],
  ["woods-all-clues", (s) => cluesRead(s) >= clueCount],
  ["woods-first-chest", (s) => chestsOpened(s) >= 1],
  ["woods-chests-5", (s) => chestsOpened(s) >= chestCount],
  ["woods-lanterns", (s) => lanternsLit(s) >= lanternCount],
  ["woods-frozen-chest", (s) => s.moonChest],
  ["woods-escape", (s) => s.escaped],
  [
    "woods-swift",
    (s) => s.escaped && (s.finishTick ?? swiftTicks + 1) <= swiftTicks,
  ],
  [
    "woods-everything",
    (s) => s.escaped && chestsOpened(s) >= chestCount && s.moonChest,
  ],
  ["woods-launcher", (s) => s.parts.every(Boolean)],
  ["woods-launch-1000", (s) => (s.launch?.score ?? 0) >= 1_000],
  ...sharedMarks<WoodsState>(
    (s) => s.charms.filter(Boolean).length,
    (s) => s.plasma.gathered,
  ),
];

export const woodsMilestones = marks.map(([id]) => id);

export const woodsEarned = (state: WoodsState): readonly string[] =>
  marks.filter(([, earned]) => earned(state)).map(([id]) => id);
