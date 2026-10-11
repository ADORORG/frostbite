// The creator admission pages. One source for the manifest, the page registration, links from other
// features, and browser tests, so the paths cannot drift between them.
export const creatorApplicationPath = "/studio/creator-application";
export const creatorReviewPath = "/admin/creator-applications";
// One application in full, with the decision form. A separate path from the queue's own, so a static
// page never competes with a dynamic one.
export const creatorReviewDetailPath =
  "/admin/creator-applications/[applicationId]";
export const creatorReviewHref = (applicationId: string) =>
  `${creatorReviewPath}/${applicationId}`;
