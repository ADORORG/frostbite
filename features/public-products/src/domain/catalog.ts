export const productCatalogs = [
  {
    detailNoun: "launch",
    emptyBody: "Nothing is open to mint right now.",
    emptyTitle: "No launches yet",
    label: "Launches",
    // Empty until a launch is published, so the link stays quiet in the footer.
    navigationArea: "footer",
    navigationOrder: 10,
    featureId: "launches",
    // Launches have a part of the landing page; creators do not.
    homeRail: true,
    path: "/launches",
  },
  {
    detailNoun: "creator",
    emptyBody: "Creator profiles will show up here.",
    emptyTitle: "No creators yet",
    label: "Creators",
    navigationArea: "footer",
    navigationOrder: 20,
    featureId: "creators",
    homeRail: false,
    path: "/creators",
  },
] as const;

export type ProductCatalog = (typeof productCatalogs)[number];

// Every catalog is a navigation entry and public pages; one that has a part of the landing page says so.
export function capabilitiesOf(catalog: ProductCatalog) {
  return catalog.homeRail
    ? (["home-section", "navigation", "public-page"] as const)
    : (["navigation", "public-page"] as const);
}

export const launchesCatalog = productCatalogs[0];
export const creatorsCatalog = productCatalogs[1];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseProductSlug(value: string | undefined): string | null {
  return value && slugPattern.test(value) ? value : null;
}
