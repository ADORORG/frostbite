import { pickRendition } from "@ador/feature-uploads/presentation";
import type { ChainOption } from "@ador/shared/chain";
import type { CollectionDetail } from "@ador/shared/collections";
import {
  ArcadeBadge,
  ArcadeButton,
  ArcadeMediaTile,
  StatusLamp,
} from "@repo/ui/arcade";

import {
  isStepFilled,
  stepLabels,
  type WizardStep,
} from "../../client/progress.ts";

const checked: readonly WizardStep[] = ["details", "images", "items"];

// What the draft holds, and what it still asks for. It does not offer submission: that does not exist
// yet, and saying so plainly is better than a button that does nothing.
export function ReviewStep({
  chains,
  detail,
  listHref,
}: {
  readonly chains: readonly ChainOption[];
  readonly detail: CollectionDetail;
  readonly listHref: string;
}) {
  const { collection, items, previews } = detail;
  const chain = chains.find(
    ({ chainId }) => chainId === collection.targetChain,
  );
  const cover = previews.find(({ id }) => id === collection.coverAssetId);
  const thumbnail =
    cover === undefined
      ? undefined
      : pickRendition(cover.derivatives, "thumbnail");
  return (
    <div className="arcade-form">
      <ArcadeMediaTile
        caption={
          <>
            <strong>{collection.name}</strong>
            <span>{`${items.length} of ${collection.plannedSupply} items`}</span>
            <span>{chain?.displayName ?? collection.targetChain}</span>
          </>
        }
        image={
          thumbnail === undefined
            ? undefined
            : {
                alt: `Cover image for ${collection.name}`,
                height: thumbnail.heightPixels,
                src: thumbnail.url,
                width: thumbnail.widthPixels,
              }
        }
        placeholder="No cover image yet"
      />
      <ul aria-label="What this draft still needs">
        {checked.map((step) => (
          <li key={step}>
            {stepLabels[step]}{" "}
            {isStepFilled(detail, step) ? (
              <ArcadeBadge tone="mint">Ready</ArcadeBadge>
            ) : (
              <ArcadeBadge tone="yellow">Still needed</ArcadeBadge>
            )}
          </li>
        ))}
      </ul>
      <StatusLamp
        label="Submitting for review is not available yet. Your draft is saved privately, and only you can see it."
        tone="attention"
      />
      <div className="arcade-actions">
        <ArcadeButton href={listHref} tone="yellow">
          Back to your collections
        </ArcadeButton>
      </div>
    </div>
  );
}
