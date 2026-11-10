import { ticksPerSecond } from "./rules/constants.ts";

// The page's sense of time, frame by frame: how long the last frame took, and how far between two ticks this moment is (so the screen can
// draw between them). The run loop's ticks come from the same clock. `?fixed` (or `?fixed=5` for five ticks a frame) plays a set number of
// ticks a frame whatever the frame rate, so a slow test browser sees the same game a fast one does; a page with no address of its own (the
// simulated platform of the tests) asks the same with `data-fixed` on its root element.
const tickMs = 1000 / ticksPerSecond;

export interface FrameClock {
  readonly fixed: boolean;
  readonly now: () => number;
  // A new animation frame: the time to give the run loop, and the seconds since the last frame (never more than a twentieth).
  readonly frame: (real: number) => {
    readonly time: number;
    readonly dt: number;
  };
  // The run loop has just played `ticks` ticks at `time`.
  readonly ticked: (ticks: number, time: number) => void;
  // How far the moment is past the last tick, from 0 to 1.
  readonly share: () => number;
  readonly restart: () => void;
}

export function createFrameClock(search: string, root?: string): FrameClock {
  const asked = new URLSearchParams(search).get("fixed") ?? root ?? null;
  const fixed = asked !== null;
  const perFrame = Math.max(1, Math.min(5, Number(asked) || 1));
  let virtual = performance.now();
  let last = virtual;
  let loopLast = virtual;
  let carried = 0;
  const now = (): number => (fixed ? virtual : performance.now());
  return {
    fixed,
    frame(real) {
      virtual += tickMs * perFrame;
      const time = fixed ? virtual : real;
      const dt = fixed
        ? (tickMs * perFrame) / 1000
        : Math.min(0.05, Math.max(0, (time - last) / 1000));
      last = time;
      return { dt, time };
    },
    now,
    restart() {
      carried = 0;
      loopLast = now();
    },
    share: () => carried / tickMs,
    ticked(ticks, time) {
      carried = Math.min(
        tickMs,
        Math.max(0, carried + (time - loopLast) - ticks * tickMs),
      );
      loopLast = time;
    },
  };
}
