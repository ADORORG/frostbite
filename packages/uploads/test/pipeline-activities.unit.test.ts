import { describe, expect, it } from "vitest";

import { createAssetPipelineActivities } from "../src/application/pipeline-activities.ts";
import type { AssetProcessingResult } from "../src/application/processing-service.ts";
import type { AssetValidationResult } from "../src/application/validation-service.ts";

const validated = {
  contentSha256: "a".repeat(64),
  contentType: "image/png",
  entityTag: "e",
  height: 1,
  state: "validated",
  validatorVersion: "v",
  width: 1,
} as const;
const rejected = {
  reason: "malformed",
  state: "rejected",
  validatorVersion: "v",
} as const;
const processed = { derivatives: [], state: "processed" } as const;
const unprocessable = {
  reason: "decode-failed",
  state: "unprocessable",
} as const;

function activities(
  validation: AssetValidationResult,
  processing: AssetProcessingResult,
) {
  const seen: string[] = [];
  return {
    activities: createAssetPipelineActivities({
      processing: {
        process: async ({ assetId }) => (
          seen.push(`process:${assetId}`),
          processing
        ),
      },
      validation: {
        validate: async ({ assetId }) => (
          seen.push(`validate:${assetId}`),
          validation
        ),
      },
    }),
    seen,
  };
}

describe("asset pipeline activities", () => {
  it.each([
    [{ kind: "recorded", outcome: validated }, "validated"],
    [{ kind: "replayed", outcome: validated }, "validated"],
    [{ kind: "recorded", outcome: rejected }, "rejected"],
    [{ kind: "replayed", outcome: rejected }, "rejected"],
    [{ kind: "unavailable" }, "unavailable"],
    [{ kind: "provider-mismatch" }, "provider-mismatch"],
  ] as const)("maps validation result %j to %s", async (result, status) => {
    const { activities: pipeline, seen } = activities(result, {
      kind: "unavailable",
    });
    expect(await pipeline.validateAsset({ assetId: "a-1" })).toBe(status);
    expect(seen).toEqual(["validate:a-1"]);
  });

  it.each([
    [{ kind: "recorded", outcome: processed }, "processed"],
    [{ kind: "replayed", outcome: processed }, "processed"],
    [{ kind: "recorded", outcome: unprocessable }, "unprocessable"],
    [{ kind: "replayed", outcome: unprocessable }, "unprocessable"],
    [{ kind: "unavailable" }, "unavailable"],
    [{ kind: "not-ready" }, "not-ready"],
    [{ kind: "provider-mismatch" }, "provider-mismatch"],
  ] as const)("maps processing result %j to %s", async (result, status) => {
    const { activities: pipeline, seen } = activities(
      { kind: "unavailable" },
      result,
    );
    expect(await pipeline.processAsset({ assetId: "a-2" })).toBe(status);
    expect(seen).toEqual(["process:a-2"]);
  });

  it("exposes nothing but the status", async () => {
    const { activities: pipeline } = activities(
      { kind: "recorded", outcome: validated },
      { kind: "recorded", outcome: processed },
    );
    expect(await pipeline.validateAsset({ assetId: "a" })).toBe("validated");
    expect(typeof (await pipeline.processAsset({ assetId: "a" }))).toBe(
      "string",
    );
  });
});
