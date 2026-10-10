import type { NavigationItem } from "@ador/plugin-kit/navigation";
import {
  ArcadeBadge,
  ArcadeButton,
  ArcadeMediaTile,
  ArcadePanel,
  StatusLamp,
} from "@repo/ui/arcade";

import type {
  PublicCollection,
  PublicImage,
} from "../application/public-model.ts";
import { collectionsPath } from "../paths.ts";
import { PublicFrame } from "./public-frame.tsx";

function Picture({
  caption,
  image,
}: {
  readonly caption: string;
  readonly image: PublicImage | null;
}) {
  return (
    <ArcadeMediaTile
      caption={<span>{caption}</span>}
      image={image ?? undefined}
      placeholder="Preview unavailable"
    />
  );
}

// One approved collection as it was approved: the frozen version, never the creator's current draft.
export function CollectionDetail({
  collection,
  navigation,
}: {
  readonly collection: PublicCollection;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <PublicFrame navigation={navigation}>
      <StatusLamp label="Approved by review. Not yet minted." tone="ready" />
      <ArcadePanel eyebrow="Collection" title={collection.name}>
        <dl className="arcade-facts">
          <dt>Chain</dt>
          <dd>{collection.chainLabel}</dd>
          <dt>Planned supply</dt>
          <dd>{collection.plannedSupply.toLocaleString("en-US")}</dd>
        </dl>
        <Picture
          caption={`Cover of ${collection.name}`}
          image={collection.cover}
        />
        {collection.banner === null ? null : (
          <Picture
            caption={`Banner of ${collection.name}`}
            image={collection.banner}
          />
        )}
        <h3>About</h3>
        <p>{collection.description}</p>
        {collection.provenance === "" ? null : (
          <>
            <h3>Provenance</h3>
            <p>{collection.provenance}</p>
          </>
        )}
        <h3>{`Items (${String(collection.items.length)})`}</h3>
        <ol aria-label="Items in this collection" className="arcade-grid">
          {collection.items.map((item) => (
            <li key={item.position}>
              <Picture
                caption={`${String(item.position)}. ${item.name}`}
                image={item.image}
              />
              {item.description === "" ? null : <p>{item.description}</p>}
              {item.attributes.map(({ trait, value }) => (
                <ArcadeBadge key={trait} tone="cyan">
                  {`${trait}: ${value}`}
                </ArcadeBadge>
              ))}
            </li>
          ))}
        </ol>
        <ArcadeButton href={collectionsPath} tone="cyan">
          Browse collections
        </ArcadeButton>
      </ArcadePanel>
    </PublicFrame>
  );
}
