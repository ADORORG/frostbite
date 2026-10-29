import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { ArcadeButton, ArcadePanel, StatusLamp } from "@repo/ui/arcade";

import { collectionsPath } from "../paths.ts";
import { PublicFrame } from "./public-frame.tsx";

type Navigation = readonly NavigationItem[];

// What an empty or unreadable catalog says, here and on the landing page's rail.
export const noCollections = {
  body: "No collection has been approved yet. Drafts and creator submissions are never shown here.",
  title: "No collections online",
} as const;
export const collectionsUnavailable = {
  body: "The catalog could not be read just now. Nothing has been removed; try again in a moment.",
  title: "Collections are unavailable",
} as const;

// A catalog with nothing approved in it says so plainly; draft uploads and submissions are never shown.
export function NoCollections({
  navigation,
}: {
  readonly navigation: Navigation;
}) {
  return (
    <PublicFrame navigation={navigation}>
      <StatusLamp label="Catalog empty" tone="attention" />
      <ArcadePanel eyebrow="Public catalog" title={noCollections.title}>
        <p>{noCollections.body}</p>
        <ArcadeButton href="/" tone="cyan">
          Return home
        </ArcadeButton>
      </ArcadePanel>
    </PublicFrame>
  );
}

// A page that could not read the catalog says that, rather than showing an empty or missing catalog.
export function CatalogUnavailable({
  navigation,
}: {
  readonly navigation: Navigation;
}) {
  return (
    <PublicFrame navigation={navigation}>
      <StatusLamp label="Catalog unavailable" tone="unavailable" />
      <ArcadePanel
        eyebrow="Public catalog"
        title={collectionsUnavailable.title}
      >
        <p>{collectionsUnavailable.body}</p>
        <ArcadeButton href={collectionsPath} tone="cyan">
          Try again
        </ArcadeButton>
      </ArcadePanel>
    </PublicFrame>
  );
}

// An identifier that is not a collection identifier, or one that has no approved version (never
// submitted, still in review, withdrawn, or its creator no longer approved), is reported the same way.
export function CollectionNotPublished({
  navigation,
  valid,
}: {
  readonly navigation: Navigation;
  readonly valid: boolean;
}) {
  return (
    <PublicFrame navigation={navigation}>
      <StatusLamp
        label={valid ? "Record not published" : "Invalid identifier"}
        tone="unavailable"
      />
      <ArcadePanel
        eyebrow="Collection detail"
        title={valid ? "collection unavailable" : "Invalid route"}
      >
        <p>
          {valid
            ? "No approved collection matches this address."
            : "This collection identifier is not valid."}
        </p>
        <ArcadeButton href={collectionsPath} tone="cyan">
          Browse collections
        </ArcadeButton>
      </ArcadePanel>
    </PublicFrame>
  );
}
