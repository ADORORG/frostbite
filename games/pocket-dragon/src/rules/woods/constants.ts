// Chapter two, THE WHISPERING WOODS, in whole numbers. The woods are a square of cells, each `cell` subunits across; a direction is a
// whole number out of 1024 (`trig.ts`); a time is ticks (sixty a second).
export const size = 17;
export const cell = 256;
// Six minutes of moonlight: more than enough to find everything, and the bound on a replay's work.
export const maxTicks = 21_600;
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

// The launch round, out past the gate, in field units (sixteen to a pixel of the screen). The launcher sits at the left; up and down
// tilt it (in steps of the woods' turn, 1,024 a circle), left and right set its power, fire launches an egg. An egg flies under gravity
// until it lands, leaves the field or hits a target. The round ends when the eggs are spent, or after half a minute.
export const fieldWidth = 4_096;
export const fieldGround = 1_920;
export const launcherX = 384;
export const launcherY = 1_760;
export const aimLow = 40;
export const aimHigh = 220;
export const aimStart = 128;
export const powerLow = 30;
export const powerHigh = 90;
export const powerStart = 60;
export const eggGravity = 4;
export const flyingEgg = 64;
export const launchTicks = 1_800;
