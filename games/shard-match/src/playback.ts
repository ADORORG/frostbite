import { sceneAt, type Scene } from "./screen/scene.ts";
import type { Cue, Timeline } from "./screen/timeline.ts";

// The playback of one swap on the screen: it counts frames (sixty a second) as the page's clock gives them, tells the page each cue (a sound, a
// word) as its frame comes, asks it to draw, and says when it is over. It is only for the eye: the rules have already played the swap, and a new
// swap, or a call to `finish`, ends the playback at once (the page then shows the state). A pause stops the count.
export interface PlaybackOptions {
  readonly cue: (cue: Cue) => void;
  readonly done: () => void;
  readonly draw: () => void;
  readonly now?: () => number;
  readonly paused: () => boolean;
  // Asks for `callback` on the next frame of the page.
  readonly schedule: (callback: () => void) => void;
}

export interface Playback {
  readonly active: () => boolean;
  // Ends the playback now (the cues not yet reached are not told), and tells the page it is done.
  readonly finish: () => void;
  readonly scene: () => Scene | null;
  readonly start: (timeline: Timeline) => void;
  readonly timeline: () => Timeline | null;
}

export const frameMs = 1_000 / 60;

export function createPlayback(options: PlaybackOptions): Playback {
  const now = options.now ?? (() => performance.now());
  let current: Timeline | null = null;
  let frame = 0;
  let last = 0;
  let carried = 0;
  let run = 0;

  function end(): void {
    current = null;
    run += 1;
    options.done();
  }

  function step(id: number): void {
    if (id !== run || current === null) return;
    const time = now();
    if (options.paused()) last = time;
    else {
      carried += time - last;
      last = time;
      const whole = Math.floor(carried / frameMs);
      carried -= whole * frameMs;
      const from = frame;
      frame += whole;
      for (const cue of current.cues)
        if (cue.frame > from && cue.frame <= frame) options.cue(cue);
    }
    if (current !== null && frame >= current.length) {
      end();
      return;
    }
    options.draw();
    options.schedule(() => step(id));
  }

  return {
    active: () => current !== null,
    finish() {
      if (current !== null) end();
    },
    scene: () => (current === null ? null : sceneAt(current, frame)),
    start(timeline) {
      run += 1;
      current = timeline;
      frame = 0;
      carried = 0;
      last = now();
      for (const cue of timeline.cues) if (cue.frame === 0) options.cue(cue);
      const id = run;
      options.draw();
      options.schedule(() => step(id));
    },
    timeline: () => current,
  };
}
