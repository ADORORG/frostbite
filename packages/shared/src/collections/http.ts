import { z } from "zod";

import { libraryAssetSchema } from "../uploads/library-contracts.ts";
import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";
import { collectionDraftSchema, collectionItemSchema } from "./draft.ts";

const timestamp = z.iso.datetime({ offset: true });
const collectionId = uuidV7TextSchema;

export const collectionSummarySchema = z
  .object({
    createdAt: timestamp,
    id: collectionId,
    itemCount: z.number().int().nonnegative(),
    name: collectionDraftSchema.shape.name,
    plannedSupply: collectionDraftSchema.shape.plannedSupply,
    revision: z.number().int().positive(),
    targetChain: collectionDraftSchema.shape.targetChain,
    updatedAt: timestamp,
  })
  .strict();

export const collectionItemRecordSchema = collectionItemSchema
  .extend({ id: uuidV7TextSchema, position: z.number().int().positive() })
  .strict();

export const collectionDetailSchema = z
  .object({
    collection: collectionDraftSchema
      .extend({
        createdAt: timestamp,
        id: collectionId,
        revision: z.number().int().positive(),
        updatedAt: timestamp,
      })
      .strict(),
    items: z.array(collectionItemRecordSchema),
    // The referenced assets with their processing state and short-lived signed renditions
    // (ADR-016): the preview. Never store these URLs.
    previews: z.array(libraryAssetSchema),
  })
  .strict();

// Item changes bump the collection revision; the response carries the new one, which the next
// draft save must name.
export const collectionItemChangeSchema = z
  .object({
    item: collectionItemRecordSchema,
    revision: z.number().int().positive(),
  })
  .strict();

export const collectionItemRemovedSchema = z
  .object({ removed: z.literal(true), revision: z.number().int().positive() })
  .strict();

export const createCollectionDraftInputSchema = collectionDraftSchema;
export const listCollectionDraftsInputSchema = z.object({}).strict();
export const readCollectionDraftInputSchema = z
  .object({ collectionId })
  .strict();
export const saveCollectionDraftInputSchema = z
  .object({
    collectionId,
    draft: collectionDraftSchema,
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export const addCollectionItemInputSchema = z
  .object({ collectionId, item: collectionItemSchema })
  .strict();
export const updateCollectionItemInputSchema = z
  .object({
    collectionId,
    item: collectionItemSchema,
    itemId: uuidV7TextSchema,
  })
  .strict();
export const removeCollectionItemInputSchema = z
  .object({ collectionId, itemId: uuidV7TextSchema })
  .strict();

export const collectionListResponseSchema = z
  .object({ collections: z.array(collectionSummarySchema) })
  .strict();

export const collectionRoutes = {
  addItem: {
    method: "POST",
    operationId: "addCollectionItem",
    path: "/api/v1/collection-drafts/items",
  },
  create: {
    method: "POST",
    operationId: "createCollectionDraft",
    path: "/api/v1/collection-drafts",
  },
  list: {
    method: "GET",
    operationId: "listCollectionDrafts",
    path: "/api/v1/collection-drafts",
  },
  read: {
    method: "POST",
    operationId: "readCollectionDraft",
    path: "/api/v1/collection-drafts/read",
  },
  removeItem: {
    method: "DELETE",
    operationId: "removeCollectionItem",
    path: "/api/v1/collection-drafts/items",
  },
  save: {
    method: "PUT",
    operationId: "saveCollectionDraft",
    path: "/api/v1/collection-drafts",
  },
  updateItem: {
    method: "PUT",
    operationId: "updateCollectionItem",
    path: "/api/v1/collection-drafts/items",
  },
} as const;

export type AddCollectionItemInput = z.infer<
  typeof addCollectionItemInputSchema
>;
export type CollectionItemChange = z.infer<typeof collectionItemChangeSchema>;
export type CollectionItemRemoved = z.infer<typeof collectionItemRemovedSchema>;
export type CollectionDetail = z.infer<typeof collectionDetailSchema>;
export type CollectionListResponse = z.infer<
  typeof collectionListResponseSchema
>;
export type CollectionSummary = z.infer<typeof collectionSummarySchema>;
export type CreateCollectionDraftInput = z.infer<
  typeof createCollectionDraftInputSchema
>;
export type ListCollectionDraftsInput = z.infer<
  typeof listCollectionDraftsInputSchema
>;
export type ReadCollectionDraftInput = z.infer<
  typeof readCollectionDraftInputSchema
>;
export type RemoveCollectionItemInput = z.infer<
  typeof removeCollectionItemInputSchema
>;
export type SaveCollectionDraftInput = z.infer<
  typeof saveCollectionDraftInputSchema
>;
export type UpdateCollectionItemInput = z.infer<
  typeof updateCollectionItemInputSchema
>;
