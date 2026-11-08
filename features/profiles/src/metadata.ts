import {
  clipDescription,
  privatePage,
  type PageMetadata,
} from "@frostbite/plugin-kit/page-metadata";
import type { PublicProfileView } from "@frostbite/shared/profiles";

import { profileCopy } from "./domain/copy.ts";

// A profile's own title and summary. A name nobody shows says nothing, and is kept out of search.
export function profileMetadata(view: PublicProfileView | null): PageMetadata {
  if (view === null) return privatePage;
  return {
    description: clipDescription(profileCopy.metadata.description(view.name)),
    kind: "shared",
    title: profileCopy.metadata.title(view.name),
  };
}
