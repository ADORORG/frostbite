// Chapter one, EGG HILLS, in whole numbers. A place is in subunits (sixteen to a pixel, a tile is sixteen pixels), a speed is subunits a
// tick, a time is ticks (sixty a second). Nothing is a float, so every engine plays a run out the same way.

// A run is `stages` hills one after another, harder as they go. Six minutes is far more than a run needs, and bounds a replay's work.
export const stages = 3;
export const maxTicks = 21_600;

export const pixel = 16;
export const tile = 16 * pixel;
// The world is this many tiles high; a stage is this many long; the ground tops out at `groundRow`, and a pit has none.
export const rows = 9;
export const levelTiles = 166;
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
// Where the puff leaves Glitchy's mouth, from the top of the hero. With a berry's blaze, a puff flies twice as far.
export const mouthDrop = 3 * pixel;
export const blazeLonger = 2;
// A glitch blast (a mushroom from the backpack) is a ball this big, rolling this fast for this long (some thirty tiles); at most two
// roll at once.
export const blastSize = 10 * pixel;
export const blastSpeed = 40;
export const blastLife = 200;
export const mostBlasts = 2;

// Hearts (three to start, at most five, as in every chapter): one more for clearing each of these stages.
export { maxHearts, startHearts } from "../constants.ts";
export const heartStages = [1, 2] as const;
export const invulnerableTicks = 90;
export const hitKnock = 40;
// The name of a stage shows over the screen this long after it starts.
export const bannerTicks = 120;

// The last screen of every stage is the boss's arena: DeFu on her ledge high over the sealed portal.
export const arenaTiles = 16;
export const arenaX = (levelTiles - arenaTiles) * tile;

// The weather of each stage: gusts of wind that push, rain that makes the grass slippery and puts fire out sooner, then fog.
export const gustTicks = 150;
export const windPush = 2;
export const rainAccel = 1;
export const rainFireLife = 28;

// Metaplasma drifts to Glitchy from this far (much farther with the magnet charm), this fast, and is gathered this close.
export const plasmaReach = 40 * pixel;
export const magnetReach = 112 * pixel;
export const plasmaSpeed = 40;
export const plasmaCatch = 6 * pixel;
// The feather charm makes every jump this much stronger; the shield charm takes one hit and leaves Glitchy blinking this long.
export const featherBoost = 10;
export const shieldTicks = 60;
export const charmSize = 12 * pixel;

// The secret areas: past the end of the stage, behind walls, two more stretches of world reached only by their doors. A burrow in the
// ground leads (press down on it) into an underground tunnel that comes out at the nest; a swirl cloud high over a spring mushroom leads
// into a sky of cloud steps that comes down again a little farther on. A column whose ground is row 0 is a wall from top to bottom.
export const secretTiles = 26;
export const tunnelStart = levelTiles + 1;
export const skyStart = tunnelStart + secretTiles + 1;
export const worldTiles = skyStart + secretTiles + 1;
export const wallRow = 0;
// Nothing goes higher than two tiles over the top of the screen.
export const ceilingRow = -2;
// Wings: for this long a press of jump in the air flaps Glitchy up. The forcefield: for this long nothing can hurt Glitchy, and a
// gloomling bumped into is cheered up.
export const wingTicks = 600;
export const flapSpeed = 46;
export const forceTicks = 600;
export const pickupSize = 12 * pixel;
// A spring mushroom throws Glitchy about five tiles up, however the jump is held.
export const springSpeed = 104;
export const springWidth = 12 * pixel;
export const springHeight = 6 * pixel;
// A steam vent puffs for `ventOn` ticks out of every `ventEvery`, three tiles high.
export const ventEvery = 150;
export const ventOn = 50;
export const ventWidth = 10 * pixel;
export const ventHeight = 3 * tile;
// A rolling boulder rolls to and fro on its stretch; land on top of it to bounce off, touch its side and it bumps.
export const rollerSize = 14 * pixel;
export const rollerSpeed = 10;
// A door into or out of a secret area is this big.
export const doorSize = 16 * pixel;
