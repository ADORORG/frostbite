import { unauthenticated } from "@ador/http/outcome";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { uploadOutcomes } from "@ador/shared/uploads";
import type { CompleteIntentResult } from "@ador/uploads";
import { describe, expect, it, vi } from "vitest";

import { createCompleteUploadIntentOperation } from "../src/application/completion-operation.ts";

const userId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000001");
const intentId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000002");
const assetId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000003");
const context = {
  actorSession: null,
  actorUserId: userId,
  correlationId: userId,
};

function service(result: CompleteIntentResult) {
  return {
    complete: vi.fn(async () => result),
    create: vi.fn(),
  };
}

describe("complete upload intent operation", () => {
  it("requires authentication before constructing the service", async () => {
    const getService = vi.fn();
    const operation = createCompleteUploadIntentOperation(getService);
    await expect(
      operation.execute({ intentId }, { ...context, actorUserId: null }),
    ).resolves.toEqual(unauthenticated);
    expect(getService).not.toHaveBeenCalled();
  });

  it.each(["completed", "replayed"] as const)(
    "returns the pending asset for a %s completion",
    async (kind) => {
      const operation = createCompleteUploadIntentOperation(async () =>
        service({
          asset: { id: assetId, processingState: "pending-validation" },
          kind,
        }),
      );
      await expect(operation.execute({ intentId }, context)).resolves.toEqual({
        ok: true,
        value: {
          asset: { id: assetId, processingState: "pending-validation" },
        },
      });
    },
  );

  it.each([
    ["unavailable", "upload-not-found"],
    ["missing-object", "file-not-arrived"],
    ["invalid-object", "file-not-the-one-sent"],
  ] as const)(
    "maps %s to the catalogue's %s: its status class, its words and its reason",
    async (kind, outcome) => {
      const operation = createCompleteUploadIntentOperation(async () =>
        service({ kind }),
      );
      await expect(operation.execute({ intentId }, context)).resolves.toEqual({
        error: uploadOutcomes[outcome].http,
        message: uploadOutcomes[outcome].message,
        ok: false,
        reason: outcome,
      });
    },
  );
});
