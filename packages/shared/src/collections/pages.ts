// The creator's collection pages. One source for the manifest, the page registration, navigation, and
// browser tests, so the routes cannot drift between them.
export const collectionStudioPath = "/studio/collections";
export const collectionWizardPath = "/studio/collections/[collectionId]";
// Starting a collection has a page of its own, apart from the list of collections.
export const collectionNewPath = "/studio/collections/new";
export const collectionStudioNavigationLabel = "Collections";

export function collectionWizardHref(collectionId: string): string {
  return `${collectionStudioPath}/${collectionId}`;
}

// Staff review of submitted collections. The label stays short for the navigation bar.
export const collectionReviewQueuePath = "/admin/collection-reviews";
export const collectionReviewDetailPath =
  "/admin/collection-reviews/[submissionId]";
// Every review event across every submission, for staff. A separate path from the queue's `[submissionId]`
// pages, so a static page never competes with a dynamic one.
export const collectionReviewActivityPath = "/admin/collection-activity";
export const collectionReviewNavigationLabel = "Collection reviews";

export const collectionReviewHref = (submissionId: string) =>
  `${collectionReviewQueuePath}/${submissionId}`;
