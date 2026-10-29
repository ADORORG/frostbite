import type { Playback } from "./policy.ts";

// One thing that is drawn on a schedule: a scene on a canvas. The scheduler never touches a canvas; it only asks for frames.
export interface Participant {
  // The distance of this one from the middle of the view, for choosing the nearest.
  readonly distance: () => number;
  readonly drawFrame: (seconds: number) => void;
  readonly drawStill: () => void;
  readonly fps: number;
  // Runs whenever it is visible, outside the cap (a backdrop is one thing worth looking at).
  readonly force: boolean;
}

// The clock and frame loop the scheduler runs on, so tests can drive it by hand and nothing here reaches for `window`.
export interface SchedulerEnvironment {
  readonly cancelFrame: (handle: number) => void;
  readonly hidden: () => boolean;
  readonly requestFrame: (callback: (milliseconds: number) => void) => number;
}

export interface SchedulerOptions {
  readonly cap: number;
  readonly rankEveryMs: number;
}

export interface Registration {
  readonly dispose: () => void;
  readonly setVisible: (visible: boolean) => void;
}

export interface Scheduler {
  readonly register: (participant: Participant) => Registration;
  readonly runningCount: () => number;
  readonly setPlayback: (playback: Playback) => void;
  readonly start: () => void;
  readonly stop: () => void;
}

// Which visible participants move: all the forced ones, then the nearest to the middle of the view up to the cap.
export function chooseRunning<
  T extends Pick<Participant, "distance" | "force">,
>(visible: readonly T[], cap: number): readonly T[] {
  const forced = visible.filter((participant) => participant.force);
  const nearest = visible
    .filter((participant) => !participant.force)
    .map((participant) => ({ at: participant.distance(), participant }))
    .sort((a, b) => a.at - b.at)
    .slice(0, cap)
    .map(({ participant }) => participant);
  return [...forced, ...nearest];
}

interface Entry {
  last: number;
  readonly participant: Participant;
  running: boolean;
  stillShown: boolean;
  visible: boolean;
}

// One frame loop for every scene on the page. It draws nothing while the tab is hidden, only the visible ones, only up to the cap, each
// at its own frame rate, and gives the rest a still frame. With playback "still" nothing moves.
export function createScheduler(
  environment: SchedulerEnvironment,
  options: SchedulerOptions,
): Scheduler {
  const entries = new Set<Entry>();
  let playback: Playback = "still";
  let handle: number | null = null;
  let rankedAt = Number.NEGATIVE_INFINITY;

  function rank(): void {
    const visible = [...entries].filter((entry) => entry.visible);
    const moving =
      playback === "play"
        ? chooseRunning(
            visible.map((entry) => ({
              distance: entry.participant.distance,
              entry,
              force: entry.participant.force,
            })),
            options.cap,
          ).map(({ entry }) => entry)
        : [];
    for (const entry of entries) {
      const next = moving.includes(entry);
      // A scene that is not moving shows one still frame, drawn once each time it stops or comes into view.
      if (next || !entry.visible) entry.stillShown = false;
      else if (!entry.stillShown) {
        entry.participant.drawStill();
        entry.stillShown = true;
      }
      entry.running = next;
    }
  }

  function frame(milliseconds: number): void {
    handle = environment.requestFrame(frame);
    if (environment.hidden()) return;
    if (milliseconds - rankedAt >= options.rankEveryMs) {
      rankedAt = milliseconds;
      rank();
    }
    for (const entry of entries) {
      if (!entry.running) continue;
      if (milliseconds - entry.last < 1000 / entry.participant.fps) continue;
      entry.last = milliseconds;
      entry.participant.drawFrame(milliseconds / 1000);
    }
  }

  const rankNow = () => {
    rankedAt = Number.NEGATIVE_INFINITY;
    rank();
  };

  return {
    register: (participant) => {
      const entry: Entry = {
        last: 0,
        participant,
        running: false,
        stillShown: false,
        visible: false,
      };
      entries.add(entry);
      return {
        dispose: () => entries.delete(entry),
        setVisible: (visible) => {
          entry.visible = visible;
          rankNow();
        },
      };
    },
    runningCount: () => [...entries].filter((entry) => entry.running).length,
    setPlayback: (next) => {
      playback = next;
      rankNow();
    },
    start: () => {
      handle ??= environment.requestFrame(frame);
    },
    stop: () => {
      if (handle !== null) environment.cancelFrame(handle);
      handle = null;
    },
  };
}
