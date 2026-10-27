import type { Resource } from "@ador/client-react";

// How long a page puts up with a platform it cannot reach, in refreshes (the page asks again every `refreshMs`). These are this page's
// own tolerance; how long the platform itself serves an old reading is `rewardsPolicy.statusReadings.maxStaleMs`.
const noteAfterRefreshes = 2;
const forgetAfterRefreshes = 20;

// How old a reading the page holds is: `current` is shown as it is, `old` is shown with a note that it could not be renewed, and
// `gone` is too old to show at all, so the page says it does not know.
export type Freshness = "current" | "gone" | "old";

export function freshnessOf(
  readAt: string,
  now: number,
  refreshMs: number,
): Freshness {
  const age = now - Date.parse(readAt);
  if (age >= refreshMs * forgetAfterRefreshes) return "gone";
  return age >= refreshMs * noteAfterRefreshes ? "old" : "current";
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
  refreshMs: number,
): Held<Data> {
  if (state.status === "loading") return { status: "loading" };
  const { data } = state;
  if (data === null) return { status: "unreachable" };
  const readAt = readAtOf(data);
  const freshness =
    readAt === null ? "current" : freshnessOf(readAt, now, refreshMs);
  if (freshness === "gone") return { status: "unreachable" };
  return {
    data,
    stale: freshness === "old",
    status: "held",
  };
}
