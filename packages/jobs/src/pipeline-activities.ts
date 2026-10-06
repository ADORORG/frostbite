// Provider-neutral activity contract for the asset pipeline. Activities accept validated identifiers
// and return explicit, small, non-sensitive statuses; they never see a workflow context.
export type AssetValidationStatus =
  "validated" | "rejected" | "unavailable" | "provider-mismatch";

export type AssetProcessingStatus =
  | "processed"
  | "unprocessable"
  | "unavailable"
  | "not-ready"
  | "provider-mismatch";

export interface AssetPipelineActivities {
  processAsset(input: {
    readonly assetId: string;
  }): Promise<AssetProcessingStatus>;
  validateAsset(input: {
    readonly assetId: string;
  }): Promise<AssetValidationStatus>;
}
