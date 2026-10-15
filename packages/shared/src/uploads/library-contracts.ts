import { z } from "zod";

import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";
import {
  assetProcessingStateSchema,
  assetRejectionReasonSchema,
  derivativeKindSchema,
  uploadContentTypeSchema,
  uploadFileNameSchema,
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
    fileName: uploadFileNameSchema.nullable(),
    heightPixels: z.number().int().positive().nullable(),
    id: uuidV7TextSchema,
    processingState: assetProcessingStateSchema,
    purpose: uploadPurposeSchema,
    rejectionReason: assetRejectionReasonSchema.nullable(),
    widthPixels: z.number().int().positive().nullable(),
  })
  .strict();

// Where the next page starts: the creation time (to the millisecond) and id of the last asset of the page before it. Opaque to
// the browser, which only hands it back.
export const libraryCursorSchema = z
  .string()
  .regex(
    /^\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
  );

export const libraryResponseSchema = z
  .object({
    assets: z.array(libraryAssetSchema),
    // Where the next, older page starts, or null when this is the last page.
    nextCursor: libraryCursorSchema.nullable(),
  })
  .strict();

export const libraryEmptyInputSchema = z.object({}).strict();

// A page of older assets: those before the cursor an earlier answer gave.
export const libraryOlderInputSchema = z
  .object({ before: libraryCursorSchema })
  .strict();

export const libraryRoute = {
  method: "GET",
  operationId: "listUploadedAssets",
  path: "/api/v1/uploads/assets",
} as const;

export const libraryOlderRoute = {
  method: "POST",
  operationId: "listOlderUploadedAssets",
  path: "/api/v1/uploads/assets/older",
} as const;

export type LibraryOlderInput = z.infer<typeof libraryOlderInputSchema>;
export type LibraryEmptyInput = z.infer<typeof libraryEmptyInputSchema>;
export type LibraryAsset = z.infer<typeof libraryAssetSchema>;
export type LibraryDerivative = z.infer<typeof libraryDerivativeSchema>;
export type LibraryResponse = z.infer<typeof libraryResponseSchema>;
export type DerivativeAccess = z.infer<typeof derivativeAccessSchema>;
