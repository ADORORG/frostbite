import type { ChainOption } from "@frostbite/shared/chain";
import type { CollectionListResponse } from "@frostbite/shared/collections";
import { collectionNewPath } from "@frostbite/shared/collections";
import {
  ArcadeActionButton,
  ArcadeButton,
  ArcadeEmptyState,
  ArcadeFilterTabs,
  LoadFailureLamp,
  StatusLamp,
} from "@repo/ui/arcade";
import { useState } from "react";

import type { CoverPicture } from "../../client/covers.ts";
import {
  effectiveFilter,
  filterOptions,
  visibleCollections,
  type StandingFilter,
} from "../../client/overview.ts";
import type { LoadedResource } from "../hooks/use-resource.ts";
import { CollectionCard } from "./collection-card.tsx";

// The creator's collections in every state the list can be in: loading is not "empty", and a failed
// refresh does not hide what was already loaded. A filter narrows them by where each one stands.
export function CollectionList({
  chains,
  covers,
  list,
}: {
  readonly chains: readonly ChainOption[];
  readonly covers: ReadonlyMap<string, CoverPicture>;
  readonly list: LoadedResource<CollectionListResponse>;
}) {
  const { state } = list;
  const [chosen, setChosen] = useState<StandingFilter>("all");
  const collections =
    state.status === "loading" ? null : (state.data?.collections ?? null);
  const options = filterOptions(collections ?? []);
  const filter = effectiveFilter(options, chosen);
  const shown = visibleCollections(collections ?? [], filter);
  return (
    <section aria-label="Your collections">
      {state.status === "loading" ? (
        <StatusLamp label="Loading your collections…" tone="attention" />
      ) : null}
      {state.status === "error" ? (
        <div className="arcade-form">
          <LoadFailureLamp
            hasEarlier={collections !== null}
            subject="Your collections"
          />
          <div className="arcade-actions">
            <ArcadeActionButton onClick={list.reload} tone="yellow">
              Retry
            </ArcadeActionButton>
          </div>
        </div>
      ) : null}
      {collections !== null && collections.length === 0 ? (
        <ArcadeEmptyState
          action={
            <ArcadeButton href={collectionNewPath} tone="mint">
              Start your first collection
            </ArcadeButton>
          }
          title="No collections yet"
        >
          A collection is a set of images you describe, review, and later
          publish. Start one with a name, a supply, and a chain; you add images
          and items next.
        </ArcadeEmptyState>
      ) : null}
      {collections !== null && collections.length > 0 ? (
        <>
          <ArcadeFilterTabs
            label="Show collections that are"
            onChange={setChosen}
            options={options}
            value={filter}
          />
          <ul className="arcade-cards">
            {shown.map((collection) => (
              <li key={collection.id}>
                <CollectionCard
                  chainName={
                    chains.find(
                      ({ chainId }) => chainId === collection.targetChain,
                    )?.displayName ?? collection.targetChain
                  }
                  collection={collection}
                  cover={
                    collection.coverAssetId === null
                      ? undefined
                      : covers.get(collection.coverAssetId)
                  }
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
