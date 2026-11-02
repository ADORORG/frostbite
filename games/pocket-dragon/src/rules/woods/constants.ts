// Level three, THE WHISPERING WOODS, in whole numbers. The woods are a square of cells, each `cell` subunits across; a direction is a
// whole number out of 1024 (`trig.ts`); a time is ticks (sixty a second).
export const size = 17;
export const cell = 256;
// Fifteen minutes of moonlight, maze and all: more than enough to do everything, and the bound on a replay's work.
export const maxTicks = 54_000;
// Escaping within three minutes is quick.
export const swiftTicks = 10_800;

// How fast Glitchy turns (out of 1024 a tick), walks forward and backs up (subunits a tick), and how wide Glitchy is.
export const turnSpeed = 5;
export const walkSpeed = 7;
export const backSpeed = 5;
export const radius = 64;

// What the woods hide, and how close Glitchy must come to take a chest or read a clue stone.
export const clueCount = 3;
export const chestCount = 5;
export const lanternCount = 3;
export const reach = 110;
// Fire reaches this far ahead, lights a lantern it passes this close to, and can be breathed this often.
export const fireReach = 640;
export const fireStep = 32;
export const lanternReach = 96;
export const fireCooldown = 30;
// A berry's blaze makes fire reach twice as far in the maze, and three tiles out of it. A glitch blast in the maze rolls this far.
export const blazeLonger = 2;
export const blazeTiles = 3;
export const mazeBlastReach = 2_048;
// Extra openings knocked through the maze, so there is more than one way round.
export const loops = 14;

// What a cell of the woods holds.
export const open = 0;
export const tree = 1;
export const frozen = 2;
export const gate = 3;

// The egg launcher: four parts to find (a base, a spring, a barrel and a sight), and eggs to load it with. Once all four are found it is
// built, and the moon gate opens only for a dragon with every clue read and the launcher built.
export const partCount = 4;
export const eggCount = 10;
// Three secret charms hide in dead ends: swift feet, the sight of the whole map, and a metaplasma magnet.
export const charmCount = 3;
export const swiftSpeed = 10;
// Metaplasma drifts to Glitchy from this far (farther with the magnet), this fast, and is gathered this close.
export const plasmaReach = 200;
export const magnetReach = 600;
export const plasmaSpeed = 24;
export const plasmaCatch = 40;

// Out of the maze, seen from above (`base-map.ts`): Glitchy steps a tile every `baseStep` ticks. DeFu's guards step every `guardStep`
// and chase Glitchy from `guardSight` tiles away; her shadow dragons step every `shadowStep` and always chase. A puff of fire (every
// `fireEvery` ticks) reaches the tile ahead; the egg launcher (every `launchEvery`) throws an egg up to `eggRange` tiles, a tile every
// `eggSpeed` ticks. A guard hit is dizzy for `dizzyTicks`, and hit again while dizzy it cheers up and goes home; a shadow dragon hit is
// set free. A bump costs a heart, then Glitchy blinks for `invulnerableTicks`; the forcefield keeps every bump off for `forceTicks`.
export const baseStep = 8;
export const guardStep = 14;
export const shadowStep = 12;
export const guardSight = 4;
export const fireEvery = 24;
export const launchEvery = 30;
export const eggRange = 6;
export const eggSpeed = 3;
export const dizzyTicks = 200;
export const invulnerableTicks = 90;
export const forceTicks = 600;
// DeFu's lair: two minutes to defuse the rocket, which her shield covers until the egg factory's three valves are broken. Her laser lights
// a whole row or column of the hall (shown for `laserWarn` ticks, then burning for `laserOn`) every `laserEvery` ticks; her shockwave
// (shown for `waveWarn`) spreads a tile every `waveStep` ticks out to `waveReach` tiles from her platform, every `waveEvery` ticks from
// `waveFirst`; her factory hatches a shadow dragon `hatchFirst` ticks into the lair and every `hatchEvery` after, while fewer than
// `mostShadows` are about and until its valves are broken.
export const countdownTicks = 7_200;
export const laserEvery = 300;
export const laserWarn = 50;
export const laserOn = 30;
export const waveEvery = 420;
export const waveFirst = 150;
export const waveWarn = 45;
export const waveStep = 4;
export const waveReach = 9;
export const hatchFirst = 60;
export const hatchEvery = 240;
export const mostShadows = 4;
// Out of the maze Glitchy can fly: up from the ground to flying low (over water and what is small, out of the guards' reach and under
// DeFu's shockwave), and up again to soaring over the treetops (not in DeFu's castle, which has a roof); landing only on open ground.
// Frost vision costs `visionCost` metaplasma, lasts `visionTicks` (the world moves at half speed meanwhile), and can be used again
// `visionCooldown` ticks after it ends.
export const visionCost = 10;
export const visionTicks = 300;
export const visionCooldown = 900;
