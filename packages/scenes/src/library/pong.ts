import {
  palette,
  rect,
  sceneHeight,
  sceneWidth,
  type Scene,
} from "../engine/index.ts";

// Pong duel: a ball crosses between two paddles that chase it a beat late, leaving a trail. The ball's two motions repeat at different
// rates, so the rally never looks the same twice in a row, and together they close the loop.
const crossSeconds = 6;
const bounceSeconds = 4;
// The two motions line up again every 24 seconds, which is the loop.
const loopSeconds = 24;
const paddleHeight = 14;
const paddleWidth = 3;
const margin = 8;
const lagSeconds = 0.18;
const trail = 6;
const trailStep = 0.035;
const ballSize = 3;
const minX = margin + paddleWidth;
const maxX = sceneWidth - margin - paddleWidth - ballSize;
const minY = 2;
const maxY = sceneHeight - 2 - ballSize;

// A value that goes back and forth between 0 and 1, once back and forth every `period` seconds.
const triangle = (t: number, period: number): number => {
  const phase = (((t % period) + period) % period) / period;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
};
const ballAt = (t: number) => ({
  x: minX + (maxX - minX) * triangle(t, crossSeconds * 2),
  y: minY + (maxY - minY) * triangle(t, bounceSeconds * 2),
});

export const pong: Scene = {
  id: "pong",
  make: () => ({
    draw: (surface, t) => {
      rect(surface, 0, 0, sceneWidth, sceneHeight, palette.background);
      for (let y = 2; y < sceneHeight; y += 8)
        rect(surface, sceneWidth / 2 - 1, y, 2, 4, palette.deeper);
      for (let step = trail; step >= 1; step -= 1) {
        const past = ballAt(t - step * trailStep);
        rect(
          surface,
          past.x,
          past.y,
          ballSize,
          ballSize,
          step % 2 === 0 ? palette.purple : palette.deeper,
        );
      }
      const ball = ballAt(t);
      const chase = ballAt(t - lagSeconds).y + ballSize / 2 - paddleHeight / 2;
      const follow = Math.max(0, Math.min(sceneHeight - paddleHeight, chase));
      const away = Math.max(
        0,
        Math.min(
          sceneHeight - paddleHeight,
          ballAt(t - lagSeconds * 1.6).y + ballSize / 2 - paddleHeight / 2,
        ),
      );
      rect(surface, margin, follow, paddleWidth, paddleHeight, palette.cyan);
      rect(
        surface,
        sceneWidth - margin - paddleWidth,
        away,
        paddleWidth,
        paddleHeight,
        palette.pink,
      );
      rect(surface, ball.x, ball.y, ballSize, ballSize, palette.white);
    },
    loopSeconds,
  }),
  name: "Pong duel",
};
