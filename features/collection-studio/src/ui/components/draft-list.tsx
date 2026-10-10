import type { ChainOption } from "@ador/shared/chain";
import { collectionWizardHref } from "@ador/shared/collections";
import {
  ArcadeActionButton,
  ArcadeBadge,
  ArcadeButton,
  ArcadePanel,
  StatusLamp,
} from "@repo/ui/arcade";

import type { CollectionListResponse } from "@ador/shared/collections";
import type { LoadedResource } from "../hooks/use-resource.ts";

// The creator's drafts in every state the list can be in: loading is not "empty", and a failed
// refresh does not hide what was already loaded.
export function DraftList({
  chains,
  list,
}: {
  readonly chains: readonly ChainOption[];
  readonly list: LoadedResource<CollectionListResponse>;
}) {
  const { state } = list;
  const collections =
    state.status === "loading" ? null : (state.data?.collections ?? null);
  return (
    <ArcadePanel eyebrow="Private drafts" title="Your collections">
      {state.status === "loading" ? (
        <StatusLamp label="Loading your collections…" tone="attention" />
      ) : null}
      {state.status === "error" ? (
        <div className="arcade-form">
          <StatusLamp
            label={
              collections === null
                ? "Your collections could not be loaded."
                : "Could not refresh. Showing what was loaded earlier."
            }
            tone="unavailable"
          />
          <div className="arcade-actions">
            <ArcadeActionButton onClick={list.reload} tone="yellow">
              Retry
            </ArcadeActionButton>
          </div>
        </div>
      ) : null}
      {collections !== null && collections.length === 0 ? (
        <StatusLamp
          label="No collections yet. Start one below."
          tone="attention"
        />
      ) : null}
      {collections !== null && collections.length > 0 ? (
        <ul aria-label="Your collections" className="arcade-grid">
          {collections.map((collection) => (
            <li key={collection.id}>
              <article className="arcade-media-tile">
                <h3>{collection.name}</h3>
                <p>
                  {chains.find(
                    ({ chainId }) => chainId === collection.targetChain,
                  )?.displayName ?? collection.targetChain}
                </p>
                <ArcadeBadge tone="cyan">
                  {`${collection.itemCount} of ${collection.plannedSupply} items`}
                </ArcadeBadge>
                <p>{`Updated ${collection.updatedAt.slice(0, 10)}`}</p>
                <ArcadeButton
                  href={collectionWizardHref(collection.id)}
                  tone="mint"
                >
                  {`Continue ${collection.name}`}
                </ArcadeButton>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </ArcadePanel>
  );
}
