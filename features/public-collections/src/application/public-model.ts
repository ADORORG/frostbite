import type {
  ApprovedCollectionSummary,
  ApprovedVersion,
} from "@ador/collections";
import { pickRendition } from "@ador/feature-uploads/presentation";
import type { ChainOption } from "@ador/shared/chain";
import type { LibraryAsset } from "@ador/shared/uploads";

// What the public may see of an approved collection, and nothing else. Each field is copied across
// explicitly: the creator's identity, the review history, private notes, the content hash, and the
// draft revision never reach a page, whatever the records hold.
export interface PublicImage {
  readonly alt: string;
  readonly height: number;
  readonly src: string;
  readonly width: number;
}

export interface PublicCard {
  readonly chainLabel: string;
  readonly cover: PublicImage | null;
  readonly description: string;
  readonly id: string;
  readonly itemCount: number;
  readonly name: string;
  readonly plannedSupply: number;
}

export interface PublicItem {
  readonly attributes: readonly {
    readonly trait: string;
    readonly value: string;
  }[];
  readonly description: string;
  readonly image: PublicImage | null;
  readonly name: string;
  readonly position: number;
}

export interface PublicCollection {
  readonly banner: PublicImage | null;
  readonly chainLabel: string;
  readonly cover: PublicImage | null;
  readonly description: string;
  readonly id: string;
  readonly items: readonly PublicItem[];
  readonly name: string;
  readonly plannedSupply: number;
  readonly provenance: string;
}

// The chain by the name the configuration gives it, or its identifier when it is not configured.
export function chainLabel(
  chains: readonly ChainOption[],
  chainId: string,
): string {
  return (
    chains.find((chain) => chain.chainId === chainId)?.displayName ?? chainId
  );
}

// A larger rendition when there is one, else the thumbnail; null when the preview is unavailable, so a
// page shows a placeholder instead of a broken picture.
export function imageOf(
  previews: readonly LibraryAsset[],
  assetId: string | null,
  alt: string,
): PublicImage | null {
  const asset = previews.find(({ id }) => id === assetId);
  if (asset === undefined) return null;
  const rendition =
    pickRendition(asset.derivatives, "preview") ??
    pickRendition(asset.derivatives, "thumbnail");
  return rendition === undefined
    ? null
    : {
        alt,
        height: rendition.heightPixels,
        src: rendition.url,
        width: rendition.widthPixels,
      };
}

export function presentCard(
  summary: ApprovedCollectionSummary,
  previews: readonly LibraryAsset[],
  chains: readonly ChainOption[],
): PublicCard {
  return {
    chainLabel: chainLabel(chains, summary.targetChain),
    cover: imageOf(
      previews,
      summary.coverAssetId,
      `Cover image for ${summary.name}`,
    ),
    description: summary.description,
    id: summary.collectionId,
    itemCount: summary.itemCount,
    name: summary.name,
    plannedSupply: summary.plannedSupply,
  };
}

export function presentCollection(
  version: ApprovedVersion,
  previews: readonly LibraryAsset[],
  chains: readonly ChainOption[],
): PublicCollection {
  const { collection, items } = version.snapshot;
  return {
    banner: imageOf(
      previews,
      collection.bannerAssetId,
      `Banner image for ${collection.name}`,
    ),
    chainLabel: chainLabel(chains, collection.targetChain),
    cover: imageOf(
      previews,
      collection.coverAssetId,
      `Cover image for ${collection.name}`,
    ),
    description: collection.description,
    id: version.collectionId,
    items: items.map((item) => ({
      attributes: item.attributes.map(({ trait, value }) => ({ trait, value })),
      description: item.description,
      image: imageOf(
        previews,
        item.imageAssetId,
        `${String(item.position)}. ${item.name}`,
      ),
      name: item.name,
      position: item.position,
    })),
    name: collection.name,
    plannedSupply: collection.plannedSupply,
    provenance: collection.provenance,
  };
}
