import type {
  AssetPipelineActivities,
  AssetProcessingStatus,
  AssetValidationStatus,
} from "@ador/jobs/activities";

import type { AssetProcessingResult } from "./processing-service.ts";
import type { AssetValidationResult } from "./validation-service.ts";

export interface AssetPipelineServices {
  readonly processing: {
    process(input: {
      readonly assetId: string;
    }): Promise<AssetProcessingResult>;
  };
  readonly validation: {
    validate(input: {
      readonly assetId: string;
    }): Promise<AssetValidationResult>;
  };
}

function validationStatus(
  result: AssetValidationResult,
): AssetValidationStatus {
  return result.kind === "recorded" || result.kind === "replayed"
    ? result.outcome.state
    : result.kind;
}

function processingStatus(
  result: AssetProcessingResult,
): AssetProcessingStatus {
  return result.kind === "recorded" || result.kind === "replayed"
    ? result.outcome.state
    : result.kind;
}

// Adapts the two upload services to the provider-neutral activity contract: a workflow provider
// sees only small statuses, never outcomes, storage keys, or hashes.
export function createAssetPipelineActivities(
  services: AssetPipelineServices,
): AssetPipelineActivities {
  return {
    processAsset: async (input) =>
      processingStatus(await services.processing.process(input)),
    validateAsset: async (input) =>
      validationStatus(await services.validation.validate(input)),
  };
}
