// Everything the rules measure, in whole numbers. A run is a list of steps (there is no clock): each step moves the lantern one cell, and
// costs one unit of oil. Nothing here is a float, so every engine plays a run out the same way.
export const gameId = "lantern-maze";
export const verifierId = "lantern-maze";
export const verifierVersion = 1;

// The four ways a step goes, in the order the wall bits are kept: up, right, down, left.
export const directions = ["up", "right", "down", "left"] as const;
export type Direction = (typeof directions)[number];
export const deltas = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

// A run records at most 5,000 inputs (the platform's ceiling), and the last is the one that closes it.
export const maxMoves = 4_900;

// The lantern starts with `startPercent` of the first floor's shortest route in oil, and every step burns one. Reaching the door with the key brings the lantern down to the next
// floor with that floor's entry oil: its shortest route (from the start to the key to the door) times a share that is generous on the
// first floors and tighter as they go, to `leastGrantPercent`. A flask is worth a share of the floor's route, never less than `leastFlask`.
export const startPercent = 250;
export const firstGrantPercent = 112;
export const grantPercentStep = 1;
export const leastGrantPercent = 100;
export const flaskPercent = 8;
export const leastFlask = 3;

// The last floor. Clearing it ends the run as an escape.
export const lastFloor = 30;

// The size of a floor's maze in cells: it grows with the floor up to these.
export const widestFloor = 15;
export const tallestFloor = 9;
export const firstWidth = 6;
export const firstHeight = 4;

// Light: how far along the passages the lantern shows the maze, for the first floors, the middle ones and the deep ones.
export const sightByFloor = [
  { from: 1, sight: 4 },
  { from: 4, sight: 3 },
  { from: 9, sight: 2 },
  { from: 16, sight: 1 },
] as const;

// Flasks on a floor: two, and one more every five floors, to at most this many.
export const mostFlasks = 6;

// From the fifth floor some walls are taken out so the maze has loops: this share of its cells (in percent) per floor past the fourth,
// to at most `mostLoopPercent`.
export const loopFloor = 4;
export const mostLoopPercent = 10;

// Scoring: a cleared floor is worth `floorPoints` times its number; being quick about it adds `speedPoints` for each step under twice the
// shortest route; a flask is worth `flaskPoints`.
export const floorPoints = 100;
export const speedPoints = 4;
export const flaskPoints = 25;

// A floor is cleared "lean" in at most this share (in percent) of its shortest route.
export const leanPercent = 130;
