// Chapter one, EGG HILLS, in whole numbers. A place is in subunits (sixteen to a pixel, a tile is sixteen pixels), a speed is subunits a
// tick, a time is ticks (sixty a second). Nothing is a float, so every engine plays a run out the same way.

// A run is `stages` hills one after another, harder as they go. Six minutes is far more than a run needs, and bounds a replay's work.
export const stages = 3;
export const maxTicks = 21_600;

export const pixel = 16;
export const tile = 16 * pixel;
// The world is this many tiles high; a stage is this many long; the ground tops out at `groundRow`, and a pit has none.
export const rows = 9;
export const levelTiles = 150;
export const groundRow = 7;
export const pitRow = rows + 1;

// Glitchy is twelve pixels wide and fourteen high.
export const heroWidth = 12 * pixel;
export const heroHeight = 14 * pixel;
export const topSpeed = 20;
export const accel = 2;
export const gravity = 4;
export const maxFall = 80;
// A jump leaves the ground at this speed (two and a half tiles high); let go early and it is cut to a hop.
export const jumpSpeed = 74;
export const shortHop = 36;
// A jump pressed this long before landing, or this long after running off an edge, still counts: generous, for small hands.
export const bufferTicks = 8;
export const coyoteTicks = 8;
// Bouncing off a gloomling: higher with the jump held.
export const bounce = 48;
export const bounceHeld = 70;
export const stompDepth = 6 * pixel;

// Gloomlings are grumpy little rain clouds. They walk faster on each stage.
export const gloomWidth = 14 * pixel;
export const gloomHeight = 10 * pixel;
export const gloomSpeeds = [5, 7, 9] as const;
export const thornWidth = 12 * pixel;
export const thornHeight = 9 * pixel;
export const eggSize = 8 * pixel;
export const berrySize = 10 * pixel;

// A puff of fire: how big, how fast, how long it flies, how often Glitchy can breathe one, and how many can be in the air.
export const fireWidth = 8 * pixel;
export const fireHeight = 6 * pixel;
export const fireSpeed = 44;
export const fireLife = 40;
export const fireCooldown = 18;
export const maxFires = 2;
// Where the puff leaves Glitchy's mouth, from the top of the hero.
export const mouthDrop = 3 * pixel;

// Hearts: three to start, one more for clearing each of these stages, at most five.
export const startHearts = 3;
export const heartStages = [1, 2] as const;
export const maxHearts = 5;
export const invulnerableTicks = 90;
export const hitKnock = 40;
// The name of a stage shows over the screen this long after it starts.
export const bannerTicks = 120;
