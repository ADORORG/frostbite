import type { HttpOperation } from "@ador/http";
import { idempotencyKeyConflict } from "@ador/http/outcome";
import {
  createUploadIntentInputSchema,
  uploadIntentResponseSchema,
  uploadIntentRoutes,
  type CreateUploadIntentInput,
  type UploadIntentResponse,
} from "@ador/shared/uploads";
import type { createUploadIntentService } from "@ador/uploads";

type Service = ReturnType<typeof createUploadIntentService>;

export function createUploadIntentOperation(
  getService: () => Promise<Service>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["conflict", "invalid_request", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) {
        return {
          error: "unauthorized",
          message: "Authentication is required.",
          ok: false,
        } as const;
      }
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
        return {
          error: "conflict",
          message: "The active upload limit has been reached.",
          ok: false,
        } as const;
      if (result.kind === "invalid-size")
        return {
          error: "invalid_request",
          message: "The file exceeds the limit for this upload purpose.",
          ok: false,
        } as const;
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
