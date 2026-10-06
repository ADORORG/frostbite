import { z } from "zod";

import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";
import {
  assetProcessingStateSchema,
  assetRejectionReasonSchema,
  derivativeKindSchema,
  uploadContentTypeSchema,
} from "./contracts.ts";
import { uploadPurposeSchema } from "./upload-policy.ts";

// Whether signed derivative URLs could be issued: `none` until the asset is processed, and
// `unavailable` when it is processed but storage could not sign (the library still lists it).
export const derivativeAccessStates = [
  "available",
  "none",
  "unavailable",
] as const;
export const derivativeAccessSchema = z.enum(derivativeAccessStates);

export const libraryDerivativeSchema = z
  .object({
    contentType: uploadContentTypeSchema,
    expiresAt: z.iso.datetime({ offset: true }),
    heightPixels: z.number().int().positive(),
    kind: derivativeKindSchema,
    // A short-lived bearer URL (ADR-016): never store it, and re-request after expiry.
    // Plain http appears only for a loopback storage stand-in in local development.
    url: z.url({ protocol: /^https?$/ }),
    widthPixels: z.number().int().positive(),
  })
  .strict();

export const libraryAssetSchema = z
  .object({
    createdAt: z.iso.datetime({ offset: true }),
    derivativeAccess: derivativeAccessSchema,
    derivatives: z.array(libraryDerivativeSchema),
    heightPixels: z.number().int().positive().nullable(),
    id: uuidV7TextSchema,
    processingState: assetProcessingStateSchema,
    purpose: uploadPurposeSchema,
    rejectionReason: assetRejectionReasonSchema.nullable(),
    widthPixels: z.number().int().positive().nullable(),
  })
  .strict();

export const libraryResponseSchema = z
  .object({
    assets: z.array(libraryAssetSchema),
    // True when older assets exist beyond the page; the library has no pagination yet.
    truncated: z.boolean(),
  })
  .strict();

export const libraryEmptyInputSchema = z.object({}).strict();

export const libraryRoute = {
  method: "GET",
  operationId: "listUploadedAssets",
  path: "/api/v1/uploads/assets",
} as const;

export type LibraryEmptyInput = z.infer<typeof libraryEmptyInputSchema>;
export type LibraryAsset = z.infer<typeof libraryAssetSchema>;
export type LibraryDerivative = z.infer<typeof libraryDerivativeSchema>;
export type LibraryResponse = z.infer<typeof libraryResponseSchema>;
export type DerivativeAccess = z.infer<typeof derivativeAccessSchema>;
