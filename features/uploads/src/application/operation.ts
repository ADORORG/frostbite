import type { HttpOperation } from "@ador/http";
import { idempotencyKeyConflict, unauthenticated } from "@ador/http/outcome";
import {
  createUploadIntentInputSchema,
  uploadIntentResponseSchema,
  uploadIntentRoutes,
  type CreateUploadIntentInput,
  type UploadIntentResponse,
} from "@ador/shared/uploads";
import type { createUploadIntentService } from "@ador/uploads";

import { uploadFailure } from "./outcomes.ts";

type Service = ReturnType<typeof createUploadIntentService>;

export function createUploadIntentOperation(
  getService: () => Promise<Service>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["conflict", "invalid_request", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      if (context.idempotencyKey === undefined)
        throw new Error("Idempotency boundary missing");
      const result = await (
        await getService()
      ).create(input, {
        idempotencyKey: context.idempotencyKey,
        userId: context.actorUserId,
      });
      if (result.kind === "conflict") return idempotencyKeyConflict;
      if (result.kind === "quota-exceeded")
        return uploadFailure("upload-limit-reached");
      if (result.kind === "invalid-size")
        return uploadFailure("file-over-limit");
      return {
        ok: true,
        value: {
          intent: {
            ...result.intent,
            expiresAt: result.intent.expiresAt.toISOString(),
          },
          upload: {
            ...result.upload,
            expiresAt: result.upload.expiresAt.toISOString(),
            url: result.upload.url.toString(),
          },
        },
      } as const;
    },
    idempotency: "required",
    input: "json",
    inputSchema: createUploadIntentInputSchema,
    outputSchema: uploadIntentResponseSchema,
    ...uploadIntentRoutes.create,
  } satisfies HttpOperation<CreateUploadIntentInput, UploadIntentResponse>;
}
