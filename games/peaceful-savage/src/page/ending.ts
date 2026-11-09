import { farewell } from "../view/farewell.ts";

// The end of a run, played out before the card after it: the lit tree's farewell (at the tree, the hug, the dance out to the drums, the
// show on the stage, the hands held and the jackets lit, the lift-off one by one), or a lead gone grey taken into the coil. A run the
// player ended goes straight to the card. The player can skip what is left.
export const endingMs = {
  grey: 6_500,
  lit: Math.round(farewell.end * 1_000),
} as const;
export const drumsMs = Math.round(farewell.walk[0] * 1_000);
// The show's music: a twelve-second groove, played five times through the sixty seconds.
export const concertMs = [0, 1, 2, 3, 4].map((round) =>
  Math.round((farewell.show[0] + round * 12) * 1_000),
);

// What the ending asks the page to play, and when.
export type Cue = "concert" | "drums";

export interface Ending {
  // Plays out the end of a run that ended this way; false (and nothing to wait for) for any other end.
  readonly begin: (cause: string | null) => boolean;
  // Goes straight to the card.
  readonly skip: () => void;
}

export function createEnding(
  over: () => void,
  cue: (name: Cue) => void,
): Ending {
  let timers: ReturnType<typeof setTimeout>[] = [];
  const clear = (): void => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  };
  return {
    begin(cause) {
      clear();
      if (cause !== "lit" && cause !== "grey") return false;
      timers.push(
        setTimeout(() => {
          clear();
          over();
        }, endingMs[cause]),
      );
      if (cause === "lit") {
        timers.push(setTimeout(() => cue("drums"), drumsMs));
        for (const at of concertMs)
          timers.push(setTimeout(() => cue("concert"), at));
      }
      return true;
    },
    skip() {
      clear();
      over();
    },
  };
}
