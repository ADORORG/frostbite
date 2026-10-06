import { z } from "zod";

import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";
import { uploadPurposeSchema } from "./upload-policy.ts";

export const uploadContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const uploadContentTypeSchema = z.enum(uploadContentTypes);
export type UploadContentType = z.infer<typeof uploadContentTypeSchema>;

export const createUploadIntentInputSchema = z
  .object({
    byteLength: z.number().int().positive(),
    contentType: uploadContentTypeSchema,
    purpose: uploadPurposeSchema,
  })
  .strict();

export const completeUploadIntentInputSchema = z
  .object({ intentId: uuidV7TextSchema })
  .strict();

export const assetProcessingStates = [
  "pending-validation",
  "validated",
  "rejected",
  "processed",
  "unprocessable",
] as const;
export const assetProcessingStateSchema = z.enum(assetProcessingStates);
// Stable, non-sensitive outcomes of byte validation; never raw decoder or parser messages.
export const assetRejectionReasons = [
  "unsupported-format",
  "media-type-mismatch",
  "size-exceeded",
  "byte-length-mismatch",
  "malformed",
  "animation-unsupported",
  "dimensions-exceeded",
  "pixels-exceeded",
  // Decoding stage (W3-05): a structurally valid container that cannot be safely processed.
  "decode-failed",
  "decoded-size-mismatch",
  "content-changed",
  "processing-limit-exceeded",
] as const;
export const derivativeKinds = ["thumbnail", "preview"] as const;
export const derivativeKindSchema = z.enum(derivativeKinds);
export type DerivativeKind = z.infer<typeof derivativeKindSchema>;
export const assetRejectionReasonSchema = z.enum(assetRejectionReasons);
export type AssetRejectionReason = z.infer<typeof assetRejectionReasonSchema>;
export const assetProcessingRequestedEvent = {
  name: "uploads.assetprocessing.requested.v1",
  schemaVersion: 1,
} as const;
export const assetProcessingRequestedPayloadSchema = z
  .object({ assetId: uuidV7TextSchema, uploadIntentId: uuidV7TextSchema })
  .strict();

export const completedUploadAssetSchema = z
  .object({
    id: uuidV7TextSchema,
    processingState: assetProcessingStateSchema,
  })
  .strict();

export const completedUploadResponseSchema = z
  .object({ asset: completedUploadAssetSchema })
  .strict();

export const uploadIntentResponseSchema = z
  .object({
    intent: z
      .object({
        byteLength: z.number().int().positive(),
        contentType: uploadContentTypeSchema,
        expiresAt: z.iso.datetime({ offset: true }),
        id: uuidV7TextSchema,
        purpose: uploadPurposeSchema,
      })
      .strict(),
    upload: z
      .object({
        expiresAt: z.iso.datetime({ offset: true }),
        headers: z.record(z.string(), z.string()),
        method: z.literal("PUT"),
        url: z.url({ protocol: /^https$/ }),
      })
      .strict(),
  })
  .strict();

export const uploadIntentRoutes = {
  complete: {
    method: "POST",
    operationId: "completeUploadIntent",
    path: "/api/v1/uploads/intents/complete",
  },
  create: {
    method: "POST",
    operationId: "createUploadIntent",
    path: "/api/v1/uploads/intents",
  },
} as const;

export type CreateUploadIntentInput = z.infer<
  typeof createUploadIntentInputSchema
>;
export type CompleteUploadIntentInput = z.infer<
  typeof completeUploadIntentInputSchema
>;
export type CompletedUploadAsset = z.infer<typeof completedUploadAssetSchema>;
export type CompletedUploadResponse = z.infer<
  typeof completedUploadResponseSchema
>;
export type AssetProcessingState = z.infer<typeof assetProcessingStateSchema>;
export type UploadIntentResponse = z.infer<typeof uploadIntentResponseSchema>;
