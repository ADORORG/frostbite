// The studio page for uploads. One source for the manifest, the page registration, navigation, and
// browser tests, so the route cannot drift between them.
export const uploadsStudioPath = "/studio/uploads";
// Adding an image has a page of its own, apart from the library of images already added.
export const uploadsNewPath = "/studio/uploads/new";
// One image in full. A distinct path from `uploadsNewPath`, so a static page never competes with it.
export const uploadDetailPath = "/studio/uploads/[assetId]";
export const uploadDetailHref = (assetId: string) =>
  `${uploadsStudioPath}/${assetId}`;
export const uploadsNavigationLabel = "Uploads";
