import { points } from "./constants.ts";
import { zoneAt } from "./geometry.ts";
import { light, spark, withLight, withSpark } from "./growth.ts";
import { withColour, withNews, withPoints } from "./state.ts";
import type { PlayState } from "./types.ts";

// What the act key takes up: a maridium thread dropped by a healed grey one, a clue, a relic.
export function pickThread(state: PlayState, index: number): PlayState {
  const grey = state.greys[index];
  const picked = withPoints(
    {
      ...state,
      greys: state.greys.map((each, at) =>
        at === index ? { ...each, thread: 2 as const } : each,
      ),
      threads: state.threads + 1,
    },
    points.thread,
  );
  return withNews(
    withColour(
      picked,
      zoneAt({ x: grey?.dropX ?? 0, z: grey?.dropZ ?? 0 }),
      10,
    ),
    "thread",
    String(index),
  );
}

// A clue or a relic taken: light, a little spark, and (for a relic) something true to know.
export function gather(
  state: PlayState,
  kind: "clue" | "relic",
  index: number,
): PlayState {
  const taken =
    kind === "clue"
      ? {
          ...state,
          cluesTaken: state.cluesTaken.map((was, at) => was || at === index),
        }
      : {
          ...state,
          relicsTaken: state.relicsTaken.map((was, at) => was || at === index),
        };
  const grown = withSpark(withLight(taken, light[kind]), spark[kind]);
  return withNews(grown, kind, String(index));
}
