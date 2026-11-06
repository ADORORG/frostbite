import type {
  DatabaseClient,
  DatabaseTransaction,
} from "@frostbite/database/connection";
import { collectionItems } from "@frostbite/database/schema/collections";
import { assets, uploadIntents } from "@frostbite/database/schema/uploads";
import { collectionAssetPurposes } from "@frostbite/shared/collections";
import { uuidV7Schema } from "@frostbite/shared/identifiers";
import { and, count, desc, eq, inArray, max, sql } from "drizzle-orm";

import type {
  CollectionRepository,
  ImportRowReport,
} from "../application/repository.ts";
import { bump, editCollection } from "./guards.ts";

const itemPurpose = collectionAssetPurposes.item;

// Each imported item carries the import's key and its place in the file, so a retry of the same import
// finds the rows it already wrote, and two imports can never write the same item twice.
const itemKey = (importKey: string, index: number) => `${importKey}#${index}`;

// The creator's processed item images by lower-cased file name. A name uploaded more than once means the
// newest upload: re-uploading a corrected image under the same name replaces the old one for imports.
async function imagesByFileName(
  transaction: DatabaseTransaction,
  ownerUserId: string,
  fileNames: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const lowered = [...new Set(fileNames.map((name) => name.toLowerCase()))];
  const rows = await transaction
    .select({ fileName: uploadIntents.fileName, id: assets.id })
    .from(assets)
    .innerJoin(uploadIntents, eq(uploadIntents.id, assets.uploadIntentId))
    .where(
      and(
        eq(assets.userId, ownerUserId),
        eq(assets.processingState, "processed"),
        eq(uploadIntents.purpose, itemPurpose),
        inArray(sql`lower(${uploadIntents.fileName})`, lowered),
      ),
    )
    .orderBy(desc(assets.createdAt), desc(assets.id));
  const found = new Map<string, string>();
  for (const { fileName, id } of rows) {
    const key = fileName?.toLowerCase();
    // Newest first, so the first one seen for a name is the one used.
    if (key !== undefined && !found.has(key)) found.set(key, id);
  }
  return found;
}

export function createDrizzleImportOperation(
  database: DatabaseClient,
): Pick<CollectionRepository, "importItems"> {
  return {
    importItems(input) {
      return editCollection(
        database,
        input.ownerUserId,
        input.collectionId,
        async (transaction, locked) => {
          if (!input.dryRun) {
            const [first] = await transaction
              .select({ fingerprint: collectionItems.requestFingerprint })
              .from(collectionItems)
              .where(
                and(
                  eq(collectionItems.collectionId, input.collectionId),
                  eq(
                    collectionItems.idempotencyKey,
                    itemKey(input.idempotencyKey, 0),
                  ),
                ),
              )
              .limit(1);
            if (first !== undefined) {
              if (first.fingerprint !== input.requestFingerprint)
                return { kind: "conflict" } as const;
              const written = await transaction
                .select({
                  imageAssetId: collectionItems.imageAssetId,
                  key: collectionItems.idempotencyKey,
                })
                .from(collectionItems)
                .where(
                  and(
                    eq(collectionItems.collectionId, input.collectionId),
                    inArray(
                      collectionItems.idempotencyKey,
                      input.rows.map((_, at) =>
                        itemKey(input.idempotencyKey, at),
                      ),
                    ),
                  ),
                );
              const byKey = new Map(
                written.map(({ imageAssetId, key }) => [key, imageAssetId]),
              );
              return {
                kind: "replayed",
                revision: locked.revision,
                rows: input.rows.flatMap((_, at) => {
                  const imageAssetId = byKey.get(
                    itemKey(input.idempotencyKey, at),
                  );
                  return imageAssetId === undefined
                    ? []
                    : [
                        {
                          imageAssetId: uuidV7Schema.parse(imageAssetId),
                          problems: [],
                          row: at + 1,
                        },
                      ];
                }),
              } as const;
            }
          }
          const [{ itemCount = 0, lastPosition = 0 } = {}] = await transaction
            .select({
              itemCount: count(),
              lastPosition: max(collectionItems.position),
            })
            .from(collectionItems)
            .where(eq(collectionItems.collectionId, input.collectionId));
          if (itemCount + input.rows.length > input.itemLimit)
            return { kind: "item-limit" } as const;
          const images = await imagesByFileName(
            transaction,
            input.ownerUserId,
            input.rows.map(({ row }) => row.imageFileName),
          );
          const room = Math.max(0, locked.plannedSupply - itemCount);
          // Built as the rows are checked, and written only if every row passed.
          const values: (typeof collectionItems.$inferInsert)[] = [];
          const report: ImportRowReport[] = input.rows.map(
            ({ itemId, row }, at) => {
              const imageAssetId = images.get(row.imageFileName.toLowerCase());
              if (imageAssetId !== undefined)
                values.push({
                  attributes: row.attributes,
                  collectionId: input.collectionId,
                  createdAt: input.changedAt,
                  description: row.description,
                  id: itemId,
                  idempotencyKey: itemKey(input.idempotencyKey, at),
                  imageAssetId,
                  name: row.name,
                  position: (lastPosition ?? 0) + at + 1,
                  requestFingerprint: input.requestFingerprint,
                  updatedAt: input.changedAt,
                });
              return {
                imageAssetId:
                  imageAssetId === undefined
                    ? null
                    : uuidV7Schema.parse(imageAssetId),
                problems: [
                  ...(imageAssetId === undefined
                    ? (["image-not-found"] as const)
                    : []),
                  ...(at >= room ? (["over-supply"] as const) : []),
                ],
                row: at + 1,
              };
            },
          );
          if (
            input.dryRun ||
            report.some(({ problems }) => problems.length > 0)
          )
            return { kind: "report", rows: report } as const;
          await transaction.insert(collectionItems).values(values);
          return {
            kind: "imported",
            revision: await bump(transaction, locked, input.changedAt),
            rows: report,
          } as const;
        },
      );
    },
  };
}
