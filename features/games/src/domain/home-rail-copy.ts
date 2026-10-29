// What the landing page's rail of games says.
export const homeRailCopy = {
  link: (count: number) =>
    count === 1 ? "See the game" : `See all ${String(count)} games`,
  summary: "Games you can play in your browser.",
  title: "Games",
} as const;
