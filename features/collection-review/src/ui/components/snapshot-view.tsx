import { pickRendition } from "@ador/feature-uploads/presentation";
import type {
  ReviewSubmission,
  SubmissionSnapshot,
} from "@ador/shared/collections";
import type { LibraryAsset } from "@ador/shared/uploads";
import { ArcadeBadge, ArcadeMediaTile } from "@repo/ui/arcade";

type Item = SubmissionSnapshot["items"][number];

function Picture({
  alt,
  assetId,
  previews,
}: {
  readonly alt: string;
  readonly assetId: string | null;
  readonly previews: readonly LibraryAsset[];
}) {
  const preview = previews.find(({ id }) => id === assetId);
  const thumbnail =
    preview === undefined
      ? undefined
      : pickRendition(preview.derivatives, "thumbnail");
  return (
    <ArcadeMediaTile
      caption={<span>{alt}</span>}
      image={
        thumbnail === undefined
          ? undefined
          : {
              alt,
              height: thumbnail.heightPixels,
              src: thumbnail.url,
              width: thumbnail.widthPixels,
            }
      }
      placeholder="Preview unavailable"
    />
  );
}

// The frozen version in full, exactly as it was submitted, with the art a reviewer needs to judge it.
export function SnapshotView({
  previews,
  submission,
}: {
  readonly previews: readonly LibraryAsset[];
  readonly submission: ReviewSubmission;
}) {
  const { collection, items } = submission.snapshot;
  return (
    <section aria-label="Submitted version" className="arcade-form">
      <h3>What was submitted</h3>
      <dl className="arcade-facts">
        <dt>Target chain</dt>
        <dd>{collection.targetChain}</dd>
        <dt>Planned supply</dt>
        <dd>{collection.plannedSupply.toLocaleString("en-US")}</dd>
        <dt>Frozen from draft revision</dt>
        <dd>{submission.collectionRevision}</dd>
        <dt>Content hash</dt>
        <dd>
          <code>{submission.payloadHash}</code>
        </dd>
      </dl>
      <h4>Description</h4>
      <p>{collection.description}</p>
      <h4>Provenance</h4>
      <p>
        {collection.provenance === "" ? "None given." : collection.provenance}
      </p>
      <Picture
        alt={`Cover image for ${collection.name}`}
        assetId={collection.coverAssetId}
        previews={previews}
      />
      {collection.bannerAssetId === null ? null : (
        <Picture
          alt={`Banner image for ${collection.name}`}
          assetId={collection.bannerAssetId}
          previews={previews}
        />
      )}
      <h4>{`Items (${String(items.length)})`}</h4>
      <ol aria-label="Items in this submission" className="arcade-grid">
        {items.map((item: Item) => (
          <li key={item.id}>
            <Picture
              alt={`${String(item.position)}. ${item.name}`}
              assetId={item.imageAssetId}
              previews={previews}
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
    </section>
  );
}
