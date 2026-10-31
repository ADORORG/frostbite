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
