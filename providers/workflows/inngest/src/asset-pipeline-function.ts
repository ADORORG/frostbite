import {
  PermanentWorkflowError,
  runAssetPipeline,
  type AssetPipelineResult,
} from "@frostbite/jobs/asset-pipeline";
import type { AssetPipelineActivities } from "@frostbite/jobs/activities";
import type { WorkflowPolicy } from "@frostbite/jobs/policy";
import { NonRetriableError, type Inngest } from "inngest";

import { assetProcessingRequested } from "./events.ts";

// Stable compatibility surface: renaming the function id affects in-flight runs (ADR-003).
export const assetPipelineFunctionId = "asset-pipeline";

// The SDK accepts exactly 0-20 retries as a literal union; the policy validates the same range.
const retryCounts = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const;

export function toRetryCount(value: number): (typeof retryCounts)[number] {
  const count = retryCounts.find((candidate) => candidate === value);
  if (count === undefined)
    throw new RangeError(`Unsupported retry count: ${value}.`);
  return count;
}

interface StepTools {
  readonly step: {
    run<Result extends string>(
      id: string,
      run: () => Promise<Result>,
    ): Promise<Result>;
  };
}

// The Inngest-specific part is only this wrapper: which event, which step runner, and which failures
// are permanent. All behavior lives in the provider-neutral `runAssetPipeline`.
export function createAssetPipelineHandler(
  activities: AssetPipelineActivities,
) {
  return async ({
    event,
    step,
  }: StepTools & {
    readonly event: {
      readonly data: { readonly payload: { readonly assetId: string } };
    };
  }): Promise<AssetPipelineResult> => {
    try {
      return await runAssetPipeline({
        activities,
        assetId: event.data.payload.assetId,
        step: (id, run) => step.run(id, run),
      });
    } catch (error) {
      if (error instanceof PermanentWorkflowError)
        throw new NonRetriableError(error.message);
      throw error;
    }
  };
}

export function createAssetPipelineFunction(
  client: Inngest,
  input: {
    readonly activities: AssetPipelineActivities;
    readonly policy: WorkflowPolicy;
  },
) {
  return client.createFunction(
    {
      // Bounds memory across all runs, and keeps one asset's runs strictly serial.
      concurrency: [
        { limit: input.policy.maxConcurrentMediaRuns },
        { key: "event.data.payload.assetId", limit: 1 },
      ],
      id: assetPipelineFunctionId,
      retries: toRetryCount(input.policy.retries),
      triggers: [assetProcessingRequested],
    },
    createAssetPipelineHandler(input.activities),
  );
}
