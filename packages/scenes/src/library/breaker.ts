import {
  ease,
  palette,
  rect,
  sceneHeight,
  sceneWidth,
  stars,
  type Scene,
} from "../engine/index.ts";

// Brick breaker: a ball clears the wall while the paddle follows it. The play is worked out once. When the wall is gone it builds itself
// again row by row, the ball comes to rest on the paddle in the middle, and the next serve starts exactly where the loop began.
const columns = 10;
const brickRows = 4;
const brickWidth = 14;
const brickHeight = 6;
const wallLeft = 10;
const wallTop = 10;
const paddleWidth = 20;
const paddleY = 84;
const stepsPerSecond = 60;
const maxPlay = 28;
const startSpeed = { x: 52, y: -64 };
const rebuildSeconds = 1.2;
const restSeconds = 0.8;
const breakFlash = 0.12;
const tints = [
  palette.red,
  palette.yellow,
  palette.green,
  palette.cyan,
] as const;

interface Play {
  readonly ball: readonly (readonly [number, number])[];
  readonly broke: readonly number[];
  readonly paddle: readonly number[];
}

function simulate(): Play {
  let [x, y] = [sceneWidth / 2, paddleY - 4];
  let { x: vx, y: vy } = startSpeed;
  let paddle = sceneWidth / 2;
  const alive = Array.from({ length: columns * brickRows }, () => true);
  const broke = alive.map(() => Number.POSITIVE_INFINITY);
  const ball: (readonly [number, number])[] = [];
  const track: number[] = [];
  const dt = 1 / stepsPerSecond;
  for (let step = 0; step < maxPlay * stepsPerSecond; step += 1) {
    x += vx * dt;
    y += vy * dt;
    if (x < 2 || x > sceneWidth - 2) {
      vx = -vx;
      x = Math.max(2, Math.min(sceneWidth - 2, x));
    }
    if (y < 2) vy = Math.abs(vy);
    if (y > paddleY - 3 && vy > 0) {
      vy = -Math.abs(vy);
      vx = Math.max(-80, Math.min(80, vx + (x - paddle) * 1.2));
    }
    const hit = alive.findIndex((on, at) => {
      const left = wallLeft + (at % columns) * brickWidth;
      const top = wallTop + Math.floor(at / columns) * brickHeight;
      return (
        on &&
        x > left - 1 &&
        x < left + brickWidth &&
        y > top - 1 &&
        y < top + brickHeight
      );
    });
    if (hit >= 0) {
      alive[hit] = false;
      broke[hit] = step * dt;
      vy = -vy;
    }
    paddle += (x - paddle) * 0.12;
    ball.push([x, y]);
    track.push(
      Math.max(paddleWidth / 2, Math.min(sceneWidth - paddleWidth / 2, paddle)),
    );
    if (alive.every((on) => !on)) break;
  }
  return { ball, broke, paddle: track };
}

export const breaker: Scene = {
  id: "breaker",
  make: () => {
    const play = simulate();
    const playSeconds = play.ball.length / stepsPerSecond;
    const loopSeconds = Math.ceil(playSeconds + rebuildSeconds + restSeconds);
    const rebuildAt = loopSeconds - rebuildSeconds - restSeconds;
    return {
      draw: (surface, t) => {
        rect(surface, 0, 0, sceneWidth, sceneHeight, palette.background);
        stars(surface, 8, 30, 90);
        const playing = t < playSeconds;
        const frame = Math.min(
          play.ball.length - 1,
          Math.floor(t * stepsPerSecond),
        );
        const last = play.ball.length - 1;
        // After the last brick the paddle drifts back to the middle and the ball waits on it, ready to serve again.
        const settle = ease((t - playSeconds) / (loopSeconds - playSeconds));
        const paddle = playing
          ? (play.paddle[frame] ?? sceneWidth / 2)
          : (play.paddle[last] ?? 0) +
            (sceneWidth / 2 - (play.paddle[last] ?? 0)) * settle;
        for (let at = 0; at < play.broke.length; at += 1) {
          const left = wallLeft + (at % columns) * brickWidth;
          const row = Math.floor(at / columns);
          const top = wallTop + row * brickHeight;
          const brokeAt = play.broke[at] ?? Number.POSITIVE_INFINITY;
          // A brick is rebuilt in its own row's turn once the play is over.
          const rebuiltAt =
            rebuildAt + ((brickRows - 1 - row) / brickRows) * rebuildSeconds;
          const shown = t < brokeAt || t >= rebuiltAt;
          if (t >= brokeAt && t < brokeAt + breakFlash)
            rect(
              surface,
              left + 2,
              top,
              brickWidth - 4,
              brickHeight - 2,
              palette.white,
            );
          else if (shown)
            rect(
              surface,
              left,
              top,
              brickWidth - 1,
              brickHeight - 1,
              tints[row] ?? palette.red,
            );
        }
        rect(
          surface,
          paddle - paddleWidth / 2,
          paddleY,
          paddleWidth,
          3,
          palette.white,
        );
        const [bx, by] = playing
          ? (play.ball[frame] ?? [0, 0])
          : [paddle, paddleY - 4];
        rect(surface, bx - 1, by - 1, 3, 3, palette.yellow);
      },
      loopSeconds,
    };
  },
  name: "Brick breaker",
};
