// The public collection pages. One source for the manifest, the page registration, and tests.
export const collectionsPath = "/collections";
export const collectionPagePath = "/collections/[slug]";

export const collectionHref = (id: string) => `${collectionsPath}/${id}`;
