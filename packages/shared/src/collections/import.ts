import { z } from "zod";

import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";
import { uploadFileNameSchema } from "../uploads/contracts.ts";
import { collectionItemSchema } from "./draft.ts";
import { collectionLimits } from "./limits.ts";

// One line of an import: an item as the creator writes it, naming its image by the file name it was
// uploaded with instead of by an identifier they could not know.
export const collectionImportRowSchema = collectionItemSchema
  .omit({ imageAssetId: true })
  .extend({ imageFileName: uploadFileNameSchema })
  .strict();

// What can stop a row from being imported, as the server finds it. Everything else about a row is checked
// by `collectionImportRowSchema`, which the sender can run first.
export const collectionImportProblems = [
  // None of the creator's processed item images has this file name.
  "image-not-found",
  // The row would be past the collection's planned supply.
  "over-supply",
] as const;
export const collectionImportProblemSchema = z.enum(collectionImportProblems);

export const importCollectionItemsInputSchema = z
  .object({
    collectionId: uuidV7TextSchema,
    // Checks every row and reports, without changing anything.
    dryRun: z.boolean(),
    rows: z
      .array(collectionImportRowSchema)
      .min(1)
      .max(collectionLimits.importRows),
  })
  .strict();

export const collectionImportRowReportSchema = z
  .object({
    // The image the row's file name resolved to (the newest processed one), or null if none.
    imageAssetId: uuidV7TextSchema.nullable(),
    problems: z.array(collectionImportProblemSchema),
    // 1-based, in the order sent.
    row: z.number().int().positive(),
  })
  .strict();

export const collectionImportResponseSchema = z
  .object({
    // True only when the rows were added. A report with problems, or a dry run, is false.
    imported: z.boolean(),
    // The collection's revision after the import; null when nothing was added.
    revision: z.number().int().positive().nullable(),
    rows: z.array(collectionImportRowReportSchema),
  })
  .strict();

export const collectionImportRoute = {
  method: "POST",
  operationId: "importCollectionItems",
  path: "/api/v1/collection-drafts/items/import",
} as const;

export type CollectionImportProblem = z.infer<
  typeof collectionImportProblemSchema
>;
export type CollectionImportResponse = z.infer<
  typeof collectionImportResponseSchema
>;
export type CollectionImportRow = z.infer<typeof collectionImportRowSchema>;
export type CollectionImportRowReport = z.infer<
  typeof collectionImportRowReportSchema
>;
export type ImportCollectionItemsInput = z.infer<
  typeof importCollectionItemsInputSchema
>;
