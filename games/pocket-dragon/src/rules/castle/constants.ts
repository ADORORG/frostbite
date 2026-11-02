// Chapter three, THE GUILD AND THE CASTLE, in whole numbers: places are tiles, times are ticks (sixty a second).

// Fifteen minutes is far more than the level needs (a day, a night and a winter), and bounds a replay's work; five is quick.
export const maxTicks = 54_000;
export const swiftTicks = 18_000;
// How many ticks a step from one tile to the next takes (fewer in the swift boots).
export const stepTicks = 9;
export const swiftStep = 6;
// How many tiles of Glitchy's trail the guild follows along.
export const trailLength = 4;

// A cheer challenge: the guild's spirit, each keeper's grumble (the king's most), how long a move is shown before the reply, and how
// much a grumpy reply can cost (one up to this many).
export const spiritMax = 10;
export const grumbles = [16, 18, 20, 32] as const;
export const showTicks = 45;
export const replyMost = 3;

// A keeper's grumble back takes up to this much spirit (the king's one more); a quick cheer keeps it to one; a shield charm blocks two.
export const kingExtra = 1;
export const shieldBlocks = 2;
// Metaplasma, in pixels (sixteen to a tile): it drifts to Glitchy from a tile and a half, two pixels a tick, and is gathered at four.
export const plasmaReach = 24;
export const plasmaSpeed = 2;
export const plasmaCatch = 4;

// The night: a security guard steps every `guardStep` ticks; a puff of fire (one tile ahead, three in the ember helm) leaves it dizzy
// for `dizzyTicks` and makes it drop what it carries; a guard that bumps into Glitchy is dizzy a while too. Fire can be breathed every
// `fireEvery` ticks. A bump costs a heart, then Glitchy blinks for `invulnerableTicks`; the forcefield keeps every bump off.
export const guardStep = 15;
export const dizzyTicks = 240;
export const bumpDizzy = 150;
export const fireEvery = 30;
export const fireReach = 1;
export const helmReach = 3;
export const invulnerableTicks = 90;
export const forceTicks = 600;
// The name of a new part of the day stays up this long.
export const phaseTicks = 180;

// The guild's experience, from all it has done (`guild.ts`), and the experience each level up to ten starts at.
export const levelAt = [
  0, 150, 400, 750, 1_200, 1_750, 2_400, 3_150, 4_000, 5_000,
] as const;
