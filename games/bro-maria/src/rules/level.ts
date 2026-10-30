import { groundRow, levelTiles, slimeSpeed, tile } from "./constants.ts";
import {
  crates,
  doublePit,
  gauntlet,
  Layout,
  lonePatrol,
  pairPatrol,
  patrol,
  pit,
  pitUrchin,
  platforms,
  run,
  stair,
  step,
  urchinPair,
  urchin,
  type Stretch,
} from "./layout.ts";
import type { Level } from "./types.ts";

// A level is laid out once, from the run's seed and the stage's number, as a row of stretches of ground (see `layout.ts`). The first stage is the
// plain mix of flat runs, pits, steps, platforms, crates, single urchins and slimes. Each stage after has what the one before had, and more of
// the hard things: slimes closer together and faster, urchins in twos and on the far side of a pit, a climb of two tiles, pits close together, an
// urchin with a pair of slimes behind it; by the last stage the easy stretches are gone from the mix. Every stretch is made to be crossable
// whatever the stage, so what changes is how much is asked, never whether it can be done.
const startFlat = 8;
const endFlat = 12;
// The longest stretch laid in one go, so one that starts in time ends before the flat run to the goal.
const longestStretch = 17;
const checkpointAt = 100;
const crateEvery = 30;
const coinEvery = 2.6;

// How many tiles apart slimes are at most, and where the first trio of them lies, on each stage.
const slimeEvery = [14, 11, 9, 7, 6, 5] as const;
const trioAt = [50, 44, 38, 32, 28, 24] as const;
// How fast the slimes walk on each stage (the hero runs at 20).
const slimeSpeeds = [6, 7, 9, 11, 13, 15] as const;

// The stretches a stage may pick from at random, a stretch listed twice being twice as likely.
const mixes: readonly (readonly Stretch[])[] = [
  [run, pit, step, platforms, crates, urchin, lonePatrol, pairPatrol],
  [
    pit,
    pit,
    step,
    stair,
    crates,
    urchin,
    urchinPair,
    pitUrchin,
    lonePatrol,
    pairPatrol,
  ],
  [
    pit,
    stair,
    urchin,
    urchinPair,
    pitUrchin,
    pitUrchin,
    doublePit,
    gauntlet,
    pairPatrol,
    lonePatrol,
  ],
  [
    pit,
    stair,
    urchinPair,
    pitUrchin,
    doublePit,
    doublePit,
    gauntlet,
    gauntlet,
    pairPatrol,
    pairPatrol,
  ],
  [
    stair,
    urchinPair,
    urchinPair,
    pitUrchin,
    doublePit,
    doublePit,
    gauntlet,
    gauntlet,
    gauntlet,
    pairPatrol,
  ],
  [
    urchinPair,
    urchinPair,
    pitUrchin,
    pitUrchin,
    doublePit,
    doublePit,
    gauntlet,
    gauntlet,
    gauntlet,
    gauntlet,
  ],
];

// The seed of one stage: the run's seed with the stage's number mixed in, so the stages differ and each is the same on every replay.
export const stageSeed = (seed: number, stage: number): number =>
  Math.imul((seed ^ Math.imul(stage, 0x9e37_79b1)) >>> 0, 0x85eb_ca6b) >>> 0;

export function generateLevel(seed: number, stage = 1): Level {
  const layout = new Layout(stageSeed(seed, stage));
  const mix = mixes[stage - 1] ?? mixes[0] ?? [];
  const every = slimeEvery[stage - 1] ?? 14;
  layout.flat(0, startFlat, groundRow);
  let column = startFlat;
  let checkpointX = 0;
  let trio = false;
  while (column < levelTiles - endFlat - longestStretch) {
    if (checkpointX === 0 && column >= checkpointAt) {
      layout.flat(column, 5, groundRow);
      checkpointX = column + 2;
      column += 5;
      continue;
    }
    // Some things a level must have however the rolls fall, so a mark that asks for them can always be earned: the slimes, a trio of them
    // close together, the crates and the coins.
    if (layout.patrols.length < Math.floor(column / every))
      column += patrol(layout, column, groundRow, 2);
    else if (!trio && column >= (trioAt[stage - 1] ?? 50)) {
      column += patrol(layout, column, groundRow, 3);
      trio = true;
    } else if (layout.crates.length < Math.floor(column / crateEvery) * 2)
      column += crates(layout, column, groundRow);
    else if (layout.coins.length < Math.floor(column / coinEvery))
      column += run(layout, column, groundRow);
    else {
      const stretch = mix[layout.roll(mix.length)];
      column += (stretch ?? run)(layout, column, groundRow);
    }
  }
  layout.flat(column, levelTiles - column, groundRow);
  return {
    checkpointX: checkpointX * tile,
    coins: layout.coins,
    crates: layout.crates,
    goalX: (levelTiles - 4) * tile,
    ground: layout.ground,
    patrols: layout.patrols,
    slimeSpeed: slimeSpeeds[stage - 1] ?? slimeSpeed,
    solid: layout.solid,
    stage,
    urchins: layout.urchins,
  };
}
