import { describe, expect, it } from "vitest";

import {
  assetPipelineSteps,
  PermanentWorkflowError,
  runAssetPipeline,
  WorkflowFaultError,
  type DurableStep,
} from "../src/asset-pipeline.ts";
import type {
  AssetPipelineActivities,
  AssetProcessingStatus,
  AssetValidationStatus,
} from "../src/pipeline-activities.ts";

function setup(
  validation: AssetValidationStatus,
  processing: AssetProcessingStatus,
) {
  const calls: string[] = [];
  const steps: string[] = [];
  const activities: AssetPipelineActivities = {
    processAsset: async ({ assetId }) => {
      calls.push(`process:${assetId}`);
      return processing;
    },
    validateAsset: async ({ assetId }) => {
      calls.push(`validate:${assetId}`);
      return validation;
    },
  };
  const step: DurableStep = async (id, run) => {
    steps.push(id);
    return run();
  };
  return {
    activities,
    calls,
    run: () => runAssetPipeline({ activities, assetId: "a-1", step }),
    steps,
  };
}

describe("asset pipeline", () => {
  it("keeps its step ids stable, because renaming one affects in-flight runs", () => {
    expect(assetPipelineSteps).toEqual({
      process: "process-asset",
      validate: "validate-asset",
    });
  });

  it("validates then processes, each as a named durable step", async () => {
    const { calls, run, steps } = setup("validated", "processed");
    expect(await run()).toEqual({ outcome: "processed" });
    expect(steps).toEqual([
      assetPipelineSteps.validate,
      assetPipelineSteps.process,
    ]);
    expect(calls).toEqual(["validate:a-1", "process:a-1"]);
  });

  it("ends without processing when validation rejects the file", async () => {
    const { calls, run, steps } = setup("rejected", "processed");
    expect(await run()).toEqual({ outcome: "rejected" });
    expect(steps).toEqual([assetPipelineSteps.validate]);
    expect(calls).toEqual(["validate:a-1"]);
  });

  it("reports an unprocessable file as a normal terminal outcome, not a failure", async () => {
    expect(await setup("validated", "unprocessable").run()).toEqual({
      outcome: "unprocessable",
    });
  });

  it("treats a missing asset as permanent at either stage", async () => {
    await expect(setup("unavailable", "processed").run()).rejects.toThrow(
      PermanentWorkflowError,
    );
    await expect(setup("validated", "unavailable").run()).rejects.toThrow(
      PermanentWorkflowError,
    );
  });

  it.each([
    ["validation", setup("provider-mismatch", "processed")],
    ["processing", setup("validated", "provider-mismatch")],
    ["processing", setup("validated", "not-ready")],
  ])(
    "treats a %s platform condition as a retryable fault",
    async (stage, scenario) => {
      await expect(scenario.run()).rejects.toThrow(WorkflowFaultError);
      await expect(scenario.run()).rejects.toThrow(stage);
    },
  );

  it("does not turn the two error kinds into one another", () => {
    expect(new PermanentWorkflowError("x")).not.toBeInstanceOf(
      WorkflowFaultError,
    );
    expect(new WorkflowFaultError("x")).not.toBeInstanceOf(
      PermanentWorkflowError,
    );
  });

  it("propagates an activity failure so the provider can retry the step", async () => {
    const step: DurableStep = (_id, run) => run();
    await expect(
      runAssetPipeline({
        activities: {
          processAsset: async () => "processed",
          validateAsset: async () => {
            throw new Error("storage down");
          },
        },
        assetId: "a-1",
        step,
      }),
    ).rejects.toThrow("storage down");
  });
});
