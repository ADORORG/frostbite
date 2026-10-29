// Everything the rules measure, in whole numbers: a distance is in units (ten to a metre) and a time is in ticks (the screen runs
// thirty a second, the rules know only ticks). Nothing here is a float, so every engine plays a run out the same way.
export const gameId = "frost-runner";
export const verifierId = "frost-runner";
export const verifierVersion = 1;

// The longest a run may last (about eleven minutes), and so a bound on the work one replay does.
export const maxTicks = 20_000;
export const ticksPerSecond = 30;
export const unitsPerMetre = 10;

// The runner stands at the left edge of the world, which scrolls past it.
export const playerWidth = 12;
export const standingHeight = 18;
export const slidingHeight = 8;
export const jumpTicks = 24;
export const jumpPeak = 26;
export const slideTicks = 16;

// A spike is jumped, an icicle hangs from above and is slid under.
export const spikeWidth = 12;
export const spikeHeight = 10;
export const icicleWidth = 14;
export const icicleBottom = 14;
// Within this many units of a spike's top is a close call.
export const closeCallClearance = 3;

// A shard is picked up by touching it; high ones are only reached from the air.
export const shardSpacing = 9;
export const shardReach = 8;
export const highShardHeight = 20;
export const highShardMinimumHeight = 12;
export const shardRunLength = 3;
export const shardChancePercent = 55;
export const spikeChancePercent = 65;

// How the world is laid out ahead of the runner and how it speeds up.
export const spawnHorizon = 240;
export const firstObstacleAt = 140;
export const baseSpeed = 3;
export const speedStepUnits = 4_000;
export const topSpeedBonus = 5;
export const gapBase = 60;
export const gapPerSpeed = 14;
export const gapVariety = 40;
