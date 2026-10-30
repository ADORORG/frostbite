import { ticksIn } from "./fixed-step.ts";
import type { Pause } from "./pause.ts";

// The loop a real-time game runs on, once for every game: whole ticks from the clock, one animation frame asked for at a time, and a
// pause that stops the clock rather than hiding the game. Pausing, a hidden tab and resuming never add or drop a tick, and the time spent
// paused is not counted, so a run is the same run it would have been without the pause.
export interface RunLoopOptions {
  // Advances the game by `ticks` ticks and draws it. Returns whether the run is still going.
  readonly frame: (ticks: number) => boolean;
  readonly now?: () => number;
  readonly page?: {
    addEventListener(type: "visibilitychange", listener: () => void): void;
    readonly hidden: boolean;
  };
  readonly pause: Pause;
  readonly request?: (callback: (time: number) => void) => void;
  readonly ticksPerSecond: number;
}

export interface RunLoop {
  // True while a run is going and not paused: when the player's choices count.
  readonly active: () => boolean;
  // Starts a run unless one is going or being prepared. `prepare` is where a game asks the platform for a run; the loop starts when it ends.
  readonly launch: (prepare: () => Promise<void>) => Promise<void>;
  readonly running: () => boolean;
  // Ends the loop, for a run the game closed itself.
  readonly stop: () => void;
}

export function createRunLoop(options: RunLoopOptions): RunLoop {
  const now = options.now ?? (() => performance.now());
  const request =
    options.request ??
    ((callback: (time: number) => void) =>
      void requestAnimationFrame(callback));
  let running = false;
  let preparing = false;
  let scheduled = false;
  let carried = 0;
  let last = 0;

  function schedule(): void {
    if (scheduled) return;
    scheduled = true;
    request((time) => {
      scheduled = false;
      if (!running || options.pause.paused()) return;
      const step = ticksIn(carried, time - last, options.ticksPerSecond);
      carried = step.carried;
      last = time;
      running = options.frame(step.ticks);
      if (running) schedule();
    });
  }

  const restartClock = (): void => {
    carried = 0;
    last = now();
  };
  options.pause.subscribe((paused) => {
    if (paused || !running) return;
    restartClock();
    schedule();
  });
  options.page?.addEventListener("visibilitychange", () => {
    if (options.page?.hidden === true && running) options.pause.set(true);
  });

  return {
    active: () => running && !options.pause.paused(),
    async launch(prepare) {
      if (preparing || running) return;
      preparing = true;
      try {
        await prepare();
      } finally {
        preparing = false;
      }
      options.pause.set(false);
      running = true;
      restartClock();
      schedule();
    },
    running: () => running,
    stop() {
      running = false;
    },
  };
}
