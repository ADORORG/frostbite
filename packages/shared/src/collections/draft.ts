import { z } from "zod";

import { chainRefTextSchema } from "../chain/chain-ref.ts";
import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";
import { collectionLimits } from "./limits.ts";

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum);

export const collectionDraftSchema = z
  .object({
    bannerAssetId: uuidV7TextSchema.nullable(),
    coverAssetId: uuidV7TextSchema.nullable(),
    description: optionalText(collectionLimits.description),
    name: boundedText(collectionLimits.name),
    plannedSupply: z.number().int().min(1).max(collectionLimits.plannedSupply),
    provenance: optionalText(collectionLimits.provenance),
    targetChain: chainRefTextSchema,
  })
  .strict();

const attributeSchema = z
  .object({
    trait: boundedText(collectionLimits.attributeTraitLength),
    value: boundedText(collectionLimits.attributeValueLength),
  })
  .strict();

export const collectionItemSchema = z
  .object({
    attributes: z
      .array(attributeSchema)
      .max(collectionLimits.attributesPerItem)
      .refine(
        (attributes) =>
          new Set(attributes.map(({ trait }) => trait)).size ===
          attributes.length,
        "A trait may appear only once on an item.",
      ),
    description: optionalText(collectionLimits.itemDescription),
    imageAssetId: uuidV7TextSchema,
    name: boundedText(collectionLimits.itemName),
  })
  .strict();

export type CollectionDraft = z.infer<typeof collectionDraftSchema>;
export type CollectionItem = z.infer<typeof collectionItemSchema>;
