import type {
  AssetPipelineActivities,
  AssetProcessingStatus,
} from "./pipeline-activities.ts";

// Step ids are stable compatibility surfaces (ADR-003): renaming one affects in-flight runs.
export const assetPipelineSteps = {
  process: "process-asset",
  validate: "validate-asset",
} as const;

// Runs one unit of durable work and returns its small, serializable result. A workflow provider
// supplies a checkpointing implementation; tests supply a pass-through.
export type DurableStep = <Result extends string>(
  id: string,
  run: () => Promise<Result>,
) => Promise<Result>;

// A failure retrying cannot fix, such as an asset that does not exist.
export class PermanentWorkflowError extends Error {}
// A platform or configuration fault: retried with backoff, then surfaced as a failed run.
export class WorkflowFaultError extends Error {}

export type AssetPipelineResult =
  | { readonly outcome: "rejected" }
  | { readonly outcome: "processed" | "unprocessable" };

function fail(
  stage: string,
  status: "unavailable" | "provider-mismatch" | "not-ready",
): never {
  if (status === "unavailable")
    throw new PermanentWorkflowError(`Asset is unavailable during ${stage}.`);
  throw new WorkflowFaultError(`Asset is ${status} during ${stage}.`);
}

// Validation then processing, each a durable step. Permanent file outcomes (`rejected`,
// `unprocessable`) end the run without retry; only faults throw, so only faults are retried.
export async function runAssetPipeline(input: {
  readonly activities: AssetPipelineActivities;
  readonly assetId: string;
  readonly step: DurableStep;
}): Promise<AssetPipelineResult> {
  const { activities, assetId, step } = input;
  const validation = await step(assetPipelineSteps.validate, () =>
    activities.validateAsset({ assetId }),
  );
  if (validation === "rejected") return { outcome: "rejected" };
  if (validation !== "validated") return fail("validation", validation);
  const processing: AssetProcessingStatus = await step(
    assetPipelineSteps.process,
    () => activities.processAsset({ assetId }),
  );
  if (processing === "processed" || processing === "unprocessable")
    return { outcome: processing };
  return fail("processing", processing);
}
