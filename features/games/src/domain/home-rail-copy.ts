// What the landing page's rail of games says.
export const homeRailCopy = {
  link: (count: number) =>
    count > 1 ? `See all ${String(count)} games` : "See all games",
  summary: "Games you can play in your browser.",
  title: "Games",
} as const;
