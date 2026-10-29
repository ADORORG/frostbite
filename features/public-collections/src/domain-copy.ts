// What the landing page's rail of collections says.
export const homeRailCopy = {
  link: (count: number) =>
    count > 1 ? `See all ${String(count)} collections` : "See all collections",
  summary: "Art and collectibles from creators.",
  title: "Collections",
} as const;
