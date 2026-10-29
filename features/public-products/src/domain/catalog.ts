export const productCatalogs = [
  {
    detailNoun: "launch",
    emptyBody:
      "No launch is published. Mint controls will appear only when verified launch state is available.",
    emptyTitle: "No launches online",
    label: "Launches",
    // Empty until a launch is published, so the link stays quiet in the footer.
    navigationArea: "footer",
    navigationOrder: 10,
    featureId: "launches",
    // Launches have a part of the landing page; creators do not.
    homeRail: {
      link: "See all launches",
      summary: "Launches appear here once they are published.",
    },
    path: "/launches",
  },
  {
    detailNoun: "creator",
    emptyBody:
      "No creator profile is published. Applications remain private until staff approval and publication.",
    emptyTitle: "No creators online",
    label: "Creators",
    navigationArea: "footer",
    navigationOrder: 20,
    featureId: "creators",
    homeRail: null,
    path: "/creators",
  },
] as const;

export type ProductCatalog = (typeof productCatalogs)[number];

// Every catalog is a navigation entry and public pages; one that has a part of the landing page says so.
export function capabilitiesOf(catalog: ProductCatalog) {
  return catalog.homeRail === null
    ? (["navigation", "public-page"] as const)
    : (["home-section", "navigation", "public-page"] as const);
}

export const launchesCatalog = productCatalogs[0];
export const creatorsCatalog = productCatalogs[1];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseProductSlug(value: string | undefined): string | null {
  return value && slugPattern.test(value) ? value : null;
}
