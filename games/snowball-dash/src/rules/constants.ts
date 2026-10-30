// Everything the rules measure, in whole numbers. A distance is in sub-units (six to a screen pixel, 160 to a metre) and a time is in ticks
// (sixty a second, the screen's own rate, so a tick is a frame). Nothing here is a float, so every engine plays a run out the same way.
export const gameId = "snowball-dash";
export const verifierId = "snowball-dash";
export const verifierVersion = 2;

export const ticksPerSecond = 60;
export const subPerMetre = 160;
// The bound on the work one replay does (6 minutes 40 seconds), and on the choices a run records: a run that makes this many ends there.
export const maxTicks = 24_000;
export const maxChoices = 1_100;

// The snowball is `ballWidth` by `ballHeight`. Only its middle counts against a rock (`hitInset` each side), and a rock is cleared if the
// snowball's underside is within `topForgive` of its top.
export const ballWidth = 48;
export const ballHeight = 48;
export const hitInset = 6;
export const topForgive = 6;

// A hop: press to leave the snow at `jumpSpeed` (sub-units a tick), let go early and the climb is cut to `cutSpeed`. Gravity pulls
// `gravity` a tick every tick. A press up to `bufferTicks` before landing, or `coyoteTicks` after running off the snow, still hops.
export const jumpSpeed = 24;
export const cutSpeed = 9;
export const gravity = 1;
export const bufferTicks = 7;
export const coyoteTicks = 6;
// Below this under the snow (a crevasse) the run is over.
export const fallDepth = 96;

// The snowball rolls faster the further it has come: one level every `levelLength`, and one sub-unit a tick faster each level up to
// the top speed. Past the last level only the patterns get harder.
export const levelLength = 12_000;
export const baseSpeed = 11;
export const topSpeed = 20;
export const lastLevel = 30;

// The dimensions of each obstacle. A pit has no height: it is a gap in the snow.
export const sizes = {
  boulder: { h: 144, w: 96 },
  pit: { h: 0, w: 0 },
  rock: { h: 48, w: 60 },
  spikes: { h: 30, w: 216 },
} as const;

// A rock is cut fine if the snowball clears its top by at most this; a crevasse if the snowball lands within this of its far edge.
export const closeSolid = 12;
export const closePit = 36;

// A shard is taken when the middle of the snowball is within these of it.
export const shardReachX = 30;
export const shardReachY = 36;

// Obstacles are laid this far ahead of the snowball, the first at `firstObstacleAt`.
export const horizon = 3_600;
export const firstObstacleAt = 1_800;

// A close call in a row multiplies what the snowball scores next, by one more each time up to this.
export const maxMultiplier = 10;
