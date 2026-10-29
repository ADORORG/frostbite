// What the landing page's rail of collections says.
export const homeRailCopy = {
  items: (count: number, planned: number) =>
    `${String(count)} of ${planned.toLocaleString("en-US")} items`,
  link: (count: number) =>
    count > 1 ? `See all ${String(count)} collections` : "See all collections",
  title: "Collections",
} as const;
