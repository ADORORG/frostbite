import {
  PermanentWorkflowError,
  WorkflowFaultError,
} from "@ador/jobs/asset-pipeline";
import { NonRetriableError } from "inngest";
import { describe, expect, it } from "vitest";

import {
  assetPipelineFunctionId,
  createAssetPipelineFunction,
  createAssetPipelineHandler,
  toRetryCount,
} from "../src/asset-pipeline-function.ts";
import { assetProcessingRequested } from "../src/events.ts";
import { clientWith, devConfig } from "./support/clients.ts";

const event = { data: { payload: { assetId: "asset-9" } } };
const step = {
  run: async <Result extends string>(_id: string, run: () => Promise<Result>) =>
    run(),
};

describe("asset pipeline handler", () => {
  it("runs the pipeline for the event's asset", async () => {
    const calls: string[] = [];
    const handler = createAssetPipelineHandler({
      processAsset: async ({ assetId }) => (
        calls.push(`process:${assetId}`),
        "processed"
      ),
      validateAsset: async ({ assetId }) => (
        calls.push(`validate:${assetId}`),
        "validated"
      ),
    });
    expect(await handler({ event, step })).toEqual({ outcome: "processed" });
    expect(calls).toEqual(["validate:asset-9", "process:asset-9"]);
  });

  it("turns a permanent failure into a non-retriable error", async () => {
    const handler = createAssetPipelineHandler({
      processAsset: async () => "processed",
      validateAsset: async () => "unavailable",
    });
    const failure = handler({ event, step });
    await expect(failure).rejects.toBeInstanceOf(NonRetriableError);
    await expect(failure).rejects.toThrow("unavailable");
  });

  it("leaves a platform fault retryable", async () => {
    const handler = createAssetPipelineHandler({
      processAsset: async () => "processed",
      validateAsset: async () => "provider-mismatch",
    });
    const failure = handler({ event, step });
    await expect(failure).rejects.toBeInstanceOf(WorkflowFaultError);
    await expect(failure).rejects.not.toBeInstanceOf(NonRetriableError);
    expect(new PermanentWorkflowError("x")).not.toBeInstanceOf(
      NonRetriableError,
    );
  });

  it("lets an activity failure propagate so the provider retries the step", async () => {
    const handler = createAssetPipelineHandler({
      processAsset: async () => "processed",
      validateAsset: async () => {
        throw new Error("storage down");
      },
    });
    await expect(handler({ event, step })).rejects.toThrow("storage down");
  });
});

describe("asset pipeline function definition", () => {
  const activities = {
    processAsset: async () => "processed" as const,
    validateAsset: async () => "validated" as const,
  };
  const functionFor = (policy: {
    maxConcurrentMediaRuns: number;
    retries: number;
  }) =>
    createAssetPipelineFunction(clientWith(devConfig), { activities, policy });

  it("registers a stable id, the upload event trigger, retries, and bounded concurrency", () => {
    const fn = functionFor({ maxConcurrentMediaRuns: 3, retries: 6 });
    expect(fn.opts).toMatchObject({
      concurrency: [
        { limit: 3 },
        { key: "event.data.payload.assetId", limit: 1 },
      ],
      id: assetPipelineFunctionId,
      retries: 6,
    });
    expect(fn.opts.triggers).toEqual([assetProcessingRequested]);
    expect(assetProcessingRequested.name).toBe(
      "uploads.assetprocessing.requested.v1",
    );
    expect(fn.id("probe")).toBe("probe-asset-pipeline");
    expect(assetPipelineFunctionId).toBe("asset-pipeline");
  });

  it("supports the policy bounds", () => {
    expect(
      functionFor({ maxConcurrentMediaRuns: 1, retries: 0 }).opts,
    ).toMatchObject({
      concurrency: [
        { limit: 1 },
        { key: "event.data.payload.assetId", limit: 1 },
      ],
      retries: 0,
    });
    expect(
      functionFor({ maxConcurrentMediaRuns: 64, retries: 20 }).opts.retries,
    ).toBe(20);
  });
});

describe("retry counts", () => {
  it("accepts exactly the SDK's range", () => {
    expect([0, 1, 4, 20].map(toRetryCount)).toEqual([0, 1, 4, 20]);
    for (const invalid of [-1, 21, 1.5, Number.NaN])
      expect(() => toRetryCount(invalid)).toThrow(RangeError);
  });
});
