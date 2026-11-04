// The key that jumps to the search box; the page listens for it and the hint under the box names it, from this one place.
export const searchShortcutKey = "/";

// What the games search says. The sentences live here once, so the page and its tests agree on them.
export const searchCopy = {
  clearAll: "Clear search and filters",
  fieldHint: `A name, a kind of game or a milestone. Press ${searchShortcutKey} to jump here.`,
  fieldLabel: "Search games",
  kinds: "Kinds of game",
  playableOnly: "Playable now",
  show: "Show",
} as const;

export const foundText = (shown: number): string =>
  `${String(shown)} ${shown === 1 ? "game" : "games"} found`;

export const noMatch = (text: string) => ({
  body:
    text === ""
      ? "No game fits these filters. Turn one off to see more."
      : `Nothing matches “${text}”. Check the spelling, or try fewer words.`,
  title: "No games match",
});

// The number beside the page's name: all of them, or how many of all of them are showing.
export const countText = (shown: number, total: number): string =>
  shown === total ? String(total) : `${String(shown)} of ${String(total)}`;
