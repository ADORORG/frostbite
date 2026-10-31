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
