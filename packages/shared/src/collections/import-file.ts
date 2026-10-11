import { z } from "zod";

const scalar = z.union([z.string(), z.number(), z.boolean()]).transform(String);

// An item as it is usually written in NFT metadata files: `attributes` as a list of { trait_type, value }
// (or { trait, value }), or `traits` as a plain object. Fields not listed here are ignored, because such
// files commonly carry others (links, animation) that a collection does not keep.
export const collectionImportJsonItemSchema = z.object({
  attributes: z
    .array(
      z.object({
        trait: z.string().optional(),
        trait_type: z.string().optional(),
        value: scalar,
      }),
    )
    .optional(),
  description: z.string().optional(),
  image: z.string(),
  name: z.string(),
  traits: z.record(z.string(), scalar).optional(),
});

export type CollectionImportJsonItem = z.infer<
  typeof collectionImportJsonItemSchema
>;
