const minuteMs = 60_000;

// A count of calls in the last minute, per kind of call. `within` records the call and says whether it is
// allowed; a refused call is not recorded, so a game that keeps trying is let in again a minute after its
// last allowed call.
export function createRateLimiter<Kind extends string>(
  now: () => Date,
  kinds: readonly Kind[],
): { within(kind: Kind, limit: number): boolean } {
  const calls = new Map<Kind, number[]>(kinds.map((kind) => [kind, []]));
  return {
    within: (kind, limit) => {
      const at = now().getTime();
      const recent = (calls.get(kind) ?? []).filter(
        (time) => at - time < minuteMs,
      );
      if (recent.length >= limit) {
        calls.set(kind, recent);
        return false;
      }
      calls.set(kind, [...recent, at]);
      return true;
    },
  };
}
