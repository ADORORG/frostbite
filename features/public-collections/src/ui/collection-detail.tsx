import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import {
  ArcadeBadge,
  ArcadeButton,
  SectionBlock,
  Showcase,
  StatusLamp,
  shortenMiddle,
} from "@repo/ui/arcade";

import type { PublicCollection } from "../application/public-model.ts";
import { collectionsPath } from "../paths.ts";
import { CollectionPicture } from "./collection-picture.tsx";
import { PublicFrame } from "./public-frame.tsx";

// One approved collection as it was approved: the frozen version, never the creator's current draft. Its cover and banner lead,
// then what it is, where it came from, and every item in it.
export function CollectionDetail({
  collection,
  navigation,
}: {
  readonly collection: PublicCollection;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <PublicFrame navigation={navigation} variant="wall">
      <Showcase
        backdrop={
          collection.banner === null ? undefined : (
            <img
              alt={`Banner of ${collection.name}`}
              height={collection.banner.height}
              src={collection.banner.src}
              width={collection.banner.width}
            />
          )
        }
        cover={
          <CollectionPicture image={collection.cover} name={collection.name} />
        }
        facts={
          <>
            <span title={collection.chainLabel}>
              <ArcadeBadge tone="cyan">
                {shortenMiddle(collection.chainLabel, { head: 14, tail: 6 })}
              </ArcadeBadge>
            </span>
            <ArcadeBadge tone="yellow">{`${collection.plannedSupply.toLocaleString("en-US")} planned`}</ArcadeBadge>
            <ArcadeBadge tone="mint">{`${String(collection.items.length)} items so far`}</ArcadeBadge>
          </>
        }
        status={<StatusLamp label="Not on sale yet" tone="ready" />}
        title={collection.name}
      >
        <p>{collection.description}</p>
      </Showcase>
      {collection.provenance === "" ? null : (
        <SectionBlock title="Provenance">
          <p>{collection.provenance}</p>
        </SectionBlock>
      )}
      <SectionBlock title={`Items (${String(collection.items.length)})`}>
        <ol aria-label="Items in this collection" className="gallery">
          {collection.items.map((item) => (
            <li className="gallery__tile" key={item.position}>
              <div className="gallery__picture">
                <CollectionPicture image={item.image} name={item.name} />
              </div>
              <strong className="gallery__name">{`${String(item.position)}. ${item.name}`}</strong>
              {item.description === "" ? null : <p>{item.description}</p>}
              <div className="gallery__traits">
                {item.attributes.map(({ trait, value }) => (
                  <ArcadeBadge key={trait} tone="cyan">
                    {`${trait}: ${value}`}
                  </ArcadeBadge>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </SectionBlock>
      <ArcadeButton href={collectionsPath} tone="cyan">
        Browse collections
      </ArcadeButton>
    </PublicFrame>
  );
}
