import { z } from "zod";

import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";
import { collectionDraftSchema } from "./draft.ts";
import { collectionItemRecordSchema } from "./http.ts";
import { collectionAssetPurposes } from "./limits.ts";

export const submissionSchemaVersion = 1;

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/u);

// The frozen, reviewable copy of a collection: the draft's own fields, every item in order, and the
// content hash of every image it uses, so what was reviewed is reproducible and an asset cannot be
// swapped for another with the same id. It is written once at submission and never changed.
export const submissionSnapshotSchema = z
  .object({
    assets: z.array(
      z
        .object({
          contentSha256: sha256Hex,
          id: uuidV7TextSchema,
          purpose: z.enum([
            collectionAssetPurposes.banner,
            collectionAssetPurposes.cover,
            collectionAssetPurposes.item,
          ]),
        })
        .strict(),
    ),
    collection: collectionDraftSchema,
    items: z.array(collectionItemRecordSchema),
    schemaVersion: z.literal(submissionSchemaVersion),
  })
  .strict();

export type SubmissionSnapshot = z.infer<typeof submissionSnapshotSchema>;

// What a collection still lacks before it can be submitted. These are the beta defaults (engineering
// rules, not business policy): a description, a cover image, and every planned item present.
export const submissionRequirements = [
  "description",
  "cover-image",
  "all-items",
] as const;
export type SubmissionRequirement = (typeof submissionRequirements)[number];

// The requirement as a phrase that reads after "it needs", for every place that tells a person.
export const submissionRequirementCopy: Readonly<
  Record<SubmissionRequirement, string>
> = {
  "all-items": "every planned item",
  "cover-image": "a cover image",
  description: "a description",
};

export function missingSubmissionRequirements(input: {
  readonly collection: Pick<
    z.infer<typeof collectionDraftSchema>,
    "coverAssetId" | "description" | "plannedSupply"
  >;
  readonly itemCount: number;
}): readonly SubmissionRequirement[] {
  const { collection, itemCount } = input;
  return [
    ...(collection.description.trim() === "" ? (["description"] as const) : []),
    ...(collection.coverAssetId === null ? (["cover-image"] as const) : []),
    ...(itemCount === collection.plannedSupply ? [] : (["all-items"] as const)),
  ];
}
