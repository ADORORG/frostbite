// A moment inside a loop: `seconds` from any starting point, wrapped into [0, loop). Negative times wrap too.
export function loopTime(seconds: number, loopSeconds: number): number {
  return ((seconds % loopSeconds) + loopSeconds) % loopSeconds;
}

// Where in its loop a scene is drawn when it is not moving: far enough in that something is happening.
export const stillFraction = 0.55;

export const stillTime = (loopSeconds: number): number =>
  loopSeconds * stillFraction;

// How far something moving at `speed` a second has gone along a track that repeats every `repeat` pixels. A scene closes without a jump
// when its speed times its loop is a whole number of repeats, which the closing test holds every scene to.
export const scroll = (
  seconds: number,
  speed: number,
  repeat: number,
): number => (seconds * speed) % repeat;
