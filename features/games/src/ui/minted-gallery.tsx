"use client";

import {
  ExplorerBoundary,
  TransactionLink,
} from "@frostbite/feature-chain-status/transaction";
import { galleryPictureHref } from "@frostbite/shared/games";
import { StatusLamp } from "@repo/ui/arcade";

import type { GalleryApi } from "../client/gallery-api.ts";
import type { PublicGame } from "../domain/catalog.ts";
import { galleryCopy } from "../domain/gallery-copy.ts";
import { mintedDay } from "../domain/minted-view.ts";
import { verificationLabel } from "../domain/verification-label.ts";
import { MintedArt } from "./minted-art.tsx";
import { useGallery } from "./use-gallery.ts";

// A game's public gallery of mints: how many players minted each milestone, then every mint, newest first, a page at a time. Anyone can read
// it. A mint is "minted to" a short wallet address and says how the platform knew the milestone was earned, so the page never reads as more
// than the network's records show.
export function MintedGallery({
  api,
  explorerTxUrl,
  game,
}: {
  readonly api?: GalleryApi;
  readonly explorerTxUrl: string;
  readonly game: PublicGame;
}) {
  const { loadMore, state } = useGallery(game.id, api);
  const title = (milestoneId: string) =>
    game.milestones.find(({ id }) => id === milestoneId)?.title ?? milestoneId;
  const cover = game.cover?.image ?? null;
  if (state.kind === "loading")
    return <StatusLamp label={galleryCopy.loading} tone="attention" />;
  if (state.kind === "failed") return <p role="alert">{galleryCopy.failed}</p>;
  return (
    <div className="mint-gallery">
      <p className="mint-gallery__intro">{galleryCopy.intro}</p>
      {state.counts.length === 0 ? null : (
        <ul
          aria-label={galleryCopy.countsLabel}
          className="mint-gallery__counts"
        >
          {[...state.counts]
            .sort((a, b) => b.count - a.count)
            .map(({ count, milestoneId }) => (
              <li key={milestoneId}>
                <strong>{title(milestoneId)}</strong>
                <span>{galleryCopy.minted(count)}</span>
              </li>
            ))}
        </ul>
      )}
      {state.mints.length === 0 ? (
        <p>{galleryCopy.empty}</p>
      ) : (
        <ExplorerBoundary txUrl={explorerTxUrl}>
          <ul className="mint-gallery__grid">
            {state.mints.map((mint) => (
              <li className="mint-gallery-card" key={mint.claimId}>
                <span className="mint-gallery-card__art">
                  <MintedArt
                    claimId={mint.claimId}
                    cover={cover}
                    name={title(mint.milestoneId)}
                    src={galleryPictureHref(mint.claimId)}
                  />
                </span>
                <strong>{title(mint.milestoneId)}</strong>
                <small>{galleryCopy.mintedTo(mint.wallet)}</small>
                <small>{mintedDay(mint.mintedAt)}</small>
                {verificationLabel(mint.verification) === null ? null : (
                  <span
                    className="mint-gallery-card__level"
                    data-level={mint.verification}
                  >
                    {verificationLabel(mint.verification)}
                  </span>
                )}
                <span className="mint-gallery-card__tx">
                  <TransactionLink id={mint.transactionId} />
                </span>
              </li>
            ))}
          </ul>
        </ExplorerBoundary>
      )}
      {state.more === "none" ? null : (
        <div className="mint-gallery__more">
          <button
            disabled={state.more === "loading"}
            onClick={loadMore}
            type="button"
          >
            {state.more === "loading"
              ? galleryCopy.loading
              : galleryCopy.loadMore}
          </button>
          {state.more === "failed" ? (
            <p role="alert">{galleryCopy.loadMoreFailed}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
