// Everything the rules measure, in whole numbers. A place is in subunits (sixteen to a pixel of the screen, a tile is sixteen pixels), a
// speed is subunits a tick, a time is in ticks (the screen runs sixty a second, the rules know only ticks). Nothing here is a float, so
// every engine plays a run out the same way.
export const gameId = "bro-maria";
export const verifierId = "bro-maria";
export const verifierVersion = 2;

// A run is `stages` levels one after another, each laid out from the run's seed and its number, harder as they go. The longest a run may last
// is eight minutes (four minutes and a half a stage is far more than the fastest need), and so a bound on the work one replay does.
export const stages = 6;
export const maxTicks = 28_800;
export const ticksPerSecond = 60;

export const pixel = 16;
export const tile = 16 * pixel;
// The world is this many tiles high, and the screen shows this many across.
export const rows = 9;
export const viewTiles = 16;
export const levelTiles = 200;
// The ground, unless a stretch is raised, tops out at this row; a pit has no ground at all.
export const groundRow = 7;
export const pitRow = rows + 1;

// The hero is twelve pixels wide and fourteen high.
export const playerWidth = 12 * pixel;
export const playerHeight = 14 * pixel;
// Running: the top speed, and how fast the hero gets to it and stops from it.
export const topSpeed = 20;
export const accel = 2;
// Falling: gravity a tick, and the fastest a fall gets.
export const gravity = 4;
export const maxFall = 80;
// A jump leaves the ground at this speed (a little over two and a half tiles high); letting go of the button early cuts it to the short hop.
export const jumpSpeed = 74;
export const shortHop = 36;
// A jump pressed this many ticks before landing still counts, and one pressed this many ticks after running off an edge still counts.
export const bufferTicks = 6;
export const coyoteTicks = 6;
// Landing on a slime bounces the hero up at this speed, or at `bounceHeld` when the jump button is held.
export const bounce = 48;
export const bounceHeld = 70;

export const slimeWidth = 14 * pixel;
export const slimeHeight = 10 * pixel;
// A slime walks at this speed on the first stage and one more on each stage after.
export const slimeSpeed = 6;
export const urchinWidth = 12 * pixel;
export const urchinHeight = 10 * pixel;
export const coinSize = 8 * pixel;
// A slime is stomped when the hero's feet were above this far into it on the last tick.
export const stompDepth = 6 * pixel;

export const startLives = 3;
// A life is won by clearing each of these stages, to at most `maxLives` at once.
export const lifeStages = [2, 4] as const;
export const maxLives = 5;
// The name of a stage is shown over the screen for this long after it starts.
export const bannerTicks = 120;
// After a hit the hero cannot be hit again for this long, and a hit throws it up at this speed.
export const invulnerableTicks = 90;
export const hitKnock = 40;

// The marks that are earned by how a stage was played (`milestones.ts` holds the places and the counts): the time one stage was cleared in.
export const swiftTicks = 3_000;
// Only just over the time it takes to run across a stage without stopping.
export const lightningTicks = 2_550;
