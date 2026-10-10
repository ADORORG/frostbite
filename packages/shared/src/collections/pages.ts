// The creator's collection pages. One source for the manifest, the page registration, navigation, and
// browser tests, so the routes cannot drift between them.
export const collectionStudioPath = "/studio/collections";
export const collectionWizardPath = "/studio/collections/[collectionId]";
export const collectionStudioNavigationLabel = "My collections";

export function collectionWizardHref(collectionId: string): string {
  return `${collectionStudioPath}/${collectionId}`;
}
