export const productCatalogs = [
  {
    detailNoun: "launch",
    emptyBody:
      "No launch is published. Mint controls will appear only when verified launch state is available.",
    emptyTitle: "No launches online",
    label: "Launches",
    featureId: "launches",
    path: "/launches",
  },
  {
    detailNoun: "creator",
    emptyBody:
      "No creator profile is published. Applications remain private until staff approval and publication.",
    emptyTitle: "No creators online",
    label: "Creators",
    featureId: "creators",
    path: "/creators",
  },
  {
    detailNoun: "game",
    emptyBody:
      "No game build is published. Planned integrations are not presented as playable releases.",
    emptyTitle: "No games online",
    label: "Games",
    featureId: "games",
    path: "/games",
  },
] as const;

export type ProductCatalog = (typeof productCatalogs)[number];

export const launchesCatalog = productCatalogs[0];
export const creatorsCatalog = productCatalogs[1];
export const gamesCatalog = productCatalogs[2];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseProductSlug(value: string | undefined): string | null {
  return value && slugPattern.test(value) ? value : null;
}
