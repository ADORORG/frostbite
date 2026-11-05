// What a page says about itself to a search engine or a link preview. Plain data, no framework: the shell turns it into tags.
//
// A page that is public and worth sharing declares `shared` with the words and picture a preview shows. Anything else is
// `private`: it is told to stay out of search results and carries no preview, which is also what a page for something that
// is unlisted, unapproved or missing declares, so such a thing exposes nothing.

export interface SharedImage {
  readonly alt: string;
  // A path on this site (`/games/frost-runner/share-image`); the shell makes it absolute from the configured public origin.
  readonly path: `/${string}`;
}

export interface SharedPageMetadata {
  readonly description: string;
  // Without one, the site's default picture is used.
  readonly image?: SharedImage;
  readonly kind: "shared";
  readonly title: string;
}

export interface PrivatePageMetadata {
  readonly kind: "private";
}

export type PageMetadata = SharedPageMetadata | PrivatePageMetadata;

export const privatePage: PrivatePageMetadata = Object.freeze({
  kind: "private",
});

// Longest description a preview shows without being cut mid-word by the larger platforms.
export const descriptionLimit = 200;

// Cuts at a word boundary and marks the cut; text already short enough is returned as it is.
export function clipDescription(
  text: string,
  limit: number = descriptionLimit,
): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const room = flat.slice(0, limit - 1);
  const lastSpace = room.lastIndexOf(" ");
  const cut = lastSpace > limit / 2 ? room.slice(0, lastSpace) : room;
  return `${cut.replace(/[\s.,;:!?-]+$/, "")}…`;
}
