import type {
  DerivativeAccess,
  LibraryAsset,
  LibraryDerivative,
} from "@ador/shared/uploads";

import { assetRejectionCopy } from "./rejection-copy.ts";

export type BadgeTone = "cyan" | "mint" | "pink" | "red" | "yellow";

export interface AssetBadge {
  readonly label: string;
  readonly tone: BadgeTone;
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

export function pickRendition(
  derivatives: readonly LibraryDerivative[],
  kind: LibraryDerivative["kind"],
): LibraryDerivative | undefined {
  return derivatives.find((derivative) => derivative.kind === kind);
}

export function describeDimensions(
  asset: Pick<LibraryAsset, "heightPixels" | "widthPixels">,
): string | null {
  return asset.widthPixels === null || asset.heightPixels === null
    ? null
    : `${asset.widthPixels} × ${asset.heightPixels} px`;
}
