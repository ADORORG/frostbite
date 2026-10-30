// Whether a game is paused, kept in one place so the screen, the sound and the clock agree. Pausing changes nothing in a run's rules:
// no ticks pass and no inputs are recorded, so a paused run replays exactly like one that was not. A game that keeps time must start
// its clock again from "now" when it resumes, or the time spent paused would count.
export interface Pause {
  readonly paused: () => boolean;
  readonly set: (value: boolean) => void;
  readonly subscribe: (listener: (paused: boolean) => void) => () => void;
  readonly toggle: () => void;
}

export function createPause(): Pause {
  let paused = false;
  const listeners = new Set<(paused: boolean) => void>();
  const set = (value: boolean): void => {
    if (value === paused) return;
    paused = value;
    for (const listener of [...listeners]) listener(paused);
  };
  return {
    paused: () => paused,
    set,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    toggle: () => set(!paused),
  };
}
