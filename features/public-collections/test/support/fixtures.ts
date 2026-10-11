import type {
  ApprovedCollectionSummary,
  ApprovedVersion,
} from "@ador/collections";
import { chainOptionSchema } from "@ador/shared/chain";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import { libraryAssetFixture } from "@ador/test-kit/library-asset";

export const id = () => uuidV7Schema.parse(createUuidV7());
export const signet = "bip122:00000008819873e925422c1ff0f99f7c";
export const stamp = new Date("2026-10-10T12:00:00.000Z");

export const chains = [
  chainOptionSchema.parse({
    chainId: signet,
    displayName: "Bitcoin signet",
    enabled: true,
    family: "bitcoin-alkanes",
    role: "public-beta",
  }),
];

export const owner = id();

export const summary = (
  overrides: Partial<ApprovedCollectionSummary> = {},
): ApprovedCollectionSummary => ({
  approvedAt: stamp,
  collectionId: id(),
  coverAssetId: id(),
  description: "A small collection of hand-drawn lights.",
  itemCount: 1,
  name: "First light",
  ownerUserId: owner,
  plannedSupply: 2,
  targetChain: signet,
  ...overrides,
});

// An approved version with a cover, a banner, and one item, each with its own asset.
export function version(
  overrides: Partial<ApprovedVersion> = {},
): ApprovedVersion {
  const [cover, banner, image] = [id(), id(), id()];
  return {
    approvedAt: stamp,
    collectionId: id(),
    ownerUserId: owner,
    payloadHash: "a".repeat(64),
    sequence: 1,
    snapshot: {
      assets: [
        {
          contentSha256: "b".repeat(64),
          id: cover,
          purpose: "collection-artwork",
        },
        {
          contentSha256: "c".repeat(64),
          id: banner,
          purpose: "collection-banner",
        },
        {
          contentSha256: "d".repeat(64),
          id: image,
          purpose: "collection-item-artwork",
        },
      ],
      collection: {
        bannerAssetId: banner,
        coverAssetId: cover,
        description: "A small collection of hand-drawn lights.",
        name: "First light",
        plannedSupply: 2,
        provenance: "Drawn by hand",
        targetChain: signet,
      },
      items: [
        {
          attributes: [{ trait: "Colour", value: "Blue" }],
          description: "The first light",
          id: id(),
          imageAssetId: image,
          name: "Dawn",
          position: 1,
        },
      ],
      schemaVersion: 1,
    },
    submissionId: id(),
    ...overrides,
  };
}

// The previews the uploads library would return for every asset a version freezes.
export const previewsFor = (approved: ApprovedVersion) =>
  approved.snapshot.assets.map(({ id: assetId, purpose }) =>
    libraryAssetFixture(purpose, assetId),
  );
