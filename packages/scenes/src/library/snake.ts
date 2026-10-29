import {
  palette,
  rect,
  sceneHeight,
  sceneWidth,
  type Scene,
} from "../engine/index.ts";

// Snake: a snake follows a closed track round the board, eating the food on it. Eaten food comes back half a lap later, so the board is
// never bare. The track is a ring with an S-bend, and one lap is the loop.
const cell = 5;
const gridColumns = sceneWidth / cell;
const gridRows = sceneHeight / cell;
const left = 2;
const right = gridColumns - 3;
const top = 2;
const bottom = gridRows - 3;
const length = 14;
const stepsPerSecond = 8;
const foodEvery = 13;
// Steps are offset by half a step so none lands exactly on the moment the loop closes.
const stepPhase = 0.5;

type Spot = readonly [number, number];

// The track, cell by cell: along the top, down the right side, back along the bottom with a dip, and up the left side.
function track(): readonly Spot[] {
  const spots: Spot[] = [];
  for (let x = left; x <= right; x += 1) spots.push([x, top]);
  for (let y = top + 1; y <= bottom; y += 1) spots.push([right, y]);
  for (let x = right - 1; x >= left; x -= 1) spots.push([x, bottom]);
  for (let y = bottom - 1; y > top; y -= 1) spots.push([left, y]);
  return spots;
}

const path = track();
const loopSeconds = path.length / stepsPerSecond;

export const snake: Scene = {
  id: "snake",
  make: () => ({
    draw: (surface, t) => {
      rect(surface, 0, 0, sceneWidth, sceneHeight, palette.background);
      for (let x = 0; x < gridColumns; x += 2)
        for (let y = x % 4 === 0 ? 0 : 1; y < gridRows; y += 2)
          rect(surface, x * cell, y * cell, cell, cell, palette.deep);
      const head = Math.floor(t * stepsPerSecond + stepPhase) % path.length;
      // Food sits on the track until the head passes, and returns half a lap later.
      for (let at = 0; at < path.length; at += foodEvery) {
        const eaten = (head - at + path.length) % path.length < path.length / 2;
        const spot = path[at];
        if (spot === undefined || eaten) continue;
        rect(
          surface,
          spot[0] * cell + 1,
          spot[1] * cell + 1,
          cell - 2,
          cell - 2,
          palette.red,
        );
        rect(surface, spot[0] * cell + 2, spot[1] * cell, 1, 1, palette.green);
      }
      for (let segment = length - 1; segment >= 0; segment -= 1) {
        const spot = path[(head - segment + path.length) % path.length];
        if (spot === undefined) continue;
        const colour =
          segment === 0
            ? palette.yellow
            : segment % 2 === 0
              ? palette.green
              : palette.turfAlt;
        rect(
          surface,
          spot[0] * cell,
          spot[1] * cell,
          cell - 1,
          cell - 1,
          colour,
        );
      }
      const spot = path[head];
      if (spot !== undefined) {
        rect(
          surface,
          spot[0] * cell + 1,
          spot[1] * cell + 1,
          1,
          1,
          palette.background,
        );
        rect(
          surface,
          spot[0] * cell + 3,
          spot[1] * cell + 1,
          1,
          1,
          palette.background,
        );
      }
    },
    loopSeconds,
  }),
  name: "Snake",
};
