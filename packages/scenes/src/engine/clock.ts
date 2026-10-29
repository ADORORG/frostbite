// A moment inside a loop: `seconds` from any starting point, wrapped into [0, loop). Negative times wrap too.
export function loopTime(seconds: number, loopSeconds: number): number {
  return ((seconds % loopSeconds) + loopSeconds) % loopSeconds;
}

// Where in its loop a scene is drawn when it is not moving: far enough in that something is happening.
export const stillFraction = 0.55;

export const stillTime = (loopSeconds: number): number =>
  loopSeconds * stillFraction;
