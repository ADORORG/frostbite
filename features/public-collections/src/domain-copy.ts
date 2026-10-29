// What the landing page's rail of collections says.
export const homeRailCopy = {
  link: (count: number) =>
    count === 1 ? "See the collection" : `See all ${String(count)} collections`,
  linkUnknown: "See all collections",
  summary: "Approved collections only; drafts and submissions are never shown.",
  title: "Collections",
} as const;
