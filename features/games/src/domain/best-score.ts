// What a game's saved progress says its player's best is, when it says one: the shape every game that notes a best keeps (`{ best, sound }`, see
// the SDK's `Progress`). A game that keeps something else has no best the platform can read, and is never offered a share of one.
export function bestOf(saved: unknown): number | null {
  if (typeof saved !== "object" || saved === null || !("best" in saved))
    return null;
  const { best } = saved;
  return typeof best === "number" && Number.isSafeInteger(best) && best >= 0
    ? best
    : null;
}

// Watches a game's saves for a new best. The best the game loaded is the one to beat; the first save of a game that loaded nothing sets the
// bar and is not itself a new best (the platform cannot know what came before it). A save that does not beat the bar says nothing.
export function newBestWatcher() {
  let bar: number | null = null;
  return {
    // The game loaded its progress: that is the best to beat (none yet is a best of nothing).
    loaded(saved: unknown): void {
      bar = bestOf(saved) ?? 0;
    },
    // The game saved its progress: the new best, when this save beats the bar, otherwise null.
    saved(saved: unknown): number | null {
      const best = bestOf(saved);
      if (best === null) return null;
      const before = bar;
      if (before === null || best > before) bar = best;
      return before !== null && best > before ? best : null;
    },
  };
}
