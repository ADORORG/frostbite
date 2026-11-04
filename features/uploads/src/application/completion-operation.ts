import type { HttpOperation } from "@ador/http";
import { unauthenticated } from "@ador/http/outcome";
import {
  completeUploadIntentInputSchema,
  completedUploadResponseSchema,
  uploadIntentRoutes,
  type CompleteUploadIntentInput,
  type CompletedUploadResponse,
} from "@ador/shared/uploads";
import type { createUploadIntentService } from "@ador/uploads";

import { uploadFailure } from "./outcomes.ts";

type Service = ReturnType<typeof createUploadIntentService>;

export function createCompleteUploadIntentOperation(
  getService: () => Promise<Service>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: [
      "conflict",
      "invalid_request",
      "not_found",
      "unauthorized",
    ],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const result = await (
        await getService()
      ).complete(input, {
        correlationId: context.correlationId,
        userId: context.actorUserId,
      });
      if (result.kind === "unavailable")
        return uploadFailure("upload-not-found");
      if (result.kind === "missing-object")
        return uploadFailure("file-not-arrived");
      if (result.kind === "invalid-object")
        return uploadFailure("file-not-the-one-sent");
      return { ok: true, value: { asset: result.asset } } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: completeUploadIntentInputSchema,
    outputSchema: completedUploadResponseSchema,
    ...uploadIntentRoutes.complete,
  } satisfies HttpOperation<CompleteUploadIntentInput, CompletedUploadResponse>;
}
