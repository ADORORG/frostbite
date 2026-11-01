// Chapter three, THE GUILD AND THE CASTLE, in whole numbers: places are tiles, times are ticks (sixty a second).

// Ten minutes is far more than the quest needs, and bounds a replay's work; four is quick.
export const maxTicks = 36_000;
export const swiftTicks = 14_400;
// How many ticks a step from one tile to the next takes.
export const stepTicks = 9;
// How many tiles of Glitchy's trail the guild follows along.
export const trailLength = 4;

// A cheer challenge: the guild's spirit, each keeper's grumble (the king's most), how long a move is shown before the reply, and how
// much a grumpy reply can cost (one up to this many).
export const spiritMax = 10;
export const grumbles = [10, 11, 12, 18] as const;
export const showTicks = 45;
export const replyMost = 3;

// A keeper's grumble back takes up to this much spirit (the king's one more); a quick cheer keeps it to one; a shield charm blocks two.
export const kingExtra = 1;
export const shieldBlocks = 2;
// Metaplasma, in pixels (sixteen to a tile): it drifts to Glitchy from a tile and a half, two pixels a tick, and is gathered at four.
export const plasmaReach = 24;
export const plasmaSpeed = 2;
export const plasmaCatch = 4;
