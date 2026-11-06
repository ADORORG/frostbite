// Everything the rules measure, in whole numbers: a place is in units along the lane, a time is in ticks (the screen runs thirty a second,
// the rules know only ticks). Nothing here is a float, so every engine plays a run out the same way.
export const gameId = "starter-game";
export const verifierId = "starter-game";
export const verifierVersion = 1;

// The longest a run may last (five minutes), and so a bound on the work one replay does.
export const maxTicks = 9_000;
export const ticksPerSecond = 30;

// The marker sweeps a lane this wide, to and fro. A catch is a tap while the marker is within `zoneHalfWidth` of the middle of the zone.
export const laneWidth = 100;
export const zoneHalfWidth = 10;

// The marker moves `startSpeed` units a tick and a unit faster for every `catchesPerSpeedStep` catches, up to `topSpeed`.
export const startSpeed = 1;
export const catchesPerSpeedStep = 5;
export const topSpeed = 3;
