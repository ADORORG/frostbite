import type {
  DerivativeAccess,
  LibraryAsset,
  LibraryDerivative,
} from "@frostbite/shared/uploads";

import type { ArcadeTone } from "@repo/ui/arcade";

import { assetRejectionCopy } from "./rejection-copy.ts";

export interface AssetBadge {
  readonly label: string;
  readonly tone: ArcadeTone;
}

const badges: Readonly<Record<LibraryAsset["processingState"], AssetBadge>> = {
  "pending-validation": { label: "Checking", tone: "yellow" },
  processed: { label: "Ready", tone: "mint" },
  rejected: { label: "Rejected", tone: "red" },
  unprocessable: { label: "Unusable", tone: "red" },
  validated: { label: "Processing", tone: "yellow" },
};

export const assetBadge = (
  state: LibraryAsset["processingState"],
): AssetBadge => badges[state];

// What the tile should explain beside the image. Distinguishes a rejection (the file is the
// problem) from an unavailable preview (storage is the problem), instead of showing a blank tile.
export function assetNote(
  asset: Pick<
    LibraryAsset,
    "derivativeAccess" | "processingState" | "rejectionReason"
  >,
): string | null {
  if (asset.rejectionReason !== null)
    return assetRejectionCopy[asset.rejectionReason];
  const access: DerivativeAccess = asset.derivativeAccess;
  if (asset.processingState === "processed" && access === "unavailable")
    return "The preview is temporarily unavailable. The image itself is safe.";
  if (
    asset.processingState === "pending-validation" ||
    asset.processingState === "validated"
  )
    return "Still being checked and processed.";
  return null;
}

// What a tile says in place of a picture it does not have.
export function previewPlaceholder(
  asset: Pick<LibraryAsset, "processingState">,
): string {
  return asset.processingState === "processed"
    ? "Preview unavailable"
    : "No preview yet";
}

export function pickRendition(
  derivatives: readonly LibraryDerivative[],
  kind: LibraryDerivative["kind"],
): LibraryDerivative | undefined {
  return derivatives.find((derivative) => derivative.kind === kind);
}

// The day an image was uploaded, as the calendar date (UTC) the library shows everywhere.
export function uploadedOn(asset: Pick<LibraryAsset, "createdAt">): string {
  return asset.createdAt.slice(0, 10);
}

export function describeDimensions(
  asset: Pick<LibraryAsset, "heightPixels" | "widthPixels">,
): string | null {
  return asset.widthPixels === null || asset.heightPixels === null
    ? null
    : `${asset.widthPixels} × ${asset.heightPixels} px`;
}
