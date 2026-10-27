import type { Resource } from "@ador/client-react";

// How a page follows what the platform tells it of the chain: how often it asks, and how old a reading may get before the page stops showing
// it. `forgetAfterMs` is the platform's own limit on serving an old reading (`rewardsPolicy.statusReadings.maxStaleMs`), told to the page
// from the one place it is set, so the two cannot differ.
export interface StatusPolling {
  readonly forgetAfterMs: number;
  readonly refreshMs: number;
}

// A reading is called old, and said to be, once the page has failed to renew it for this many refreshes. A display choice, not a limit.
const noteAfterRefreshes = 2;

// How old a reading the page holds is: `current` is shown as it is, `old` is shown with a note that it could not be renewed, and
// `gone` is too old to show at all, so the page says it does not know.
export type Freshness = "current" | "gone" | "old";

export function freshnessOf(
  readAt: string,
  now: number,
  polling: StatusPolling,
): Freshness {
  const age = now - Date.parse(readAt);
  if (age >= polling.forgetAfterMs) return "gone";
  return age >= polling.refreshMs * noteAfterRefreshes ? "old" : "current";
}

// What a page holds of something it asks the platform for again and again: nothing yet, nothing it can use, or the platform's answer
// (`stale` where it is old enough to say so: the platform has been serving its last good reading, or a later ask failed and this one is
// kept). A failed ask never blanks a good answer; only age does.
export type Held<Data> =
  | { readonly status: "loading" }
  | { readonly status: "unreachable" }
  | { readonly data: Data; readonly stale: boolean; readonly status: "held" };

export function holdReading<Data>(
  state: Resource<Data, unknown>,
  // When the answer was read, where it says so; an answer without a time (no chain, could not ask) does not age.
  readAtOf: (data: Data) => string | null,
  now: number,
  polling: StatusPolling,
): Held<Data> {
  if (state.status === "loading") return { status: "loading" };
  const { data } = state;
  if (data === null) return { status: "unreachable" };
  const readAt = readAtOf(data);
  const freshness =
    readAt === null ? "current" : freshnessOf(readAt, now, polling);
  if (freshness === "gone") return { status: "unreachable" };
  return {
    data,
    stale: freshness === "old",
    status: "held",
  };
}
