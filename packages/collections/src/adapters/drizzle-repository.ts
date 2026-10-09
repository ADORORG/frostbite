import type { DatabaseClient } from "@ador/database/connection";
import {
  collectionItems,
  collections,
} from "@ador/database/schema/collections";
import { and, asc, count, desc, eq } from "drizzle-orm";

import type {
  CollectionAggregate,
  CollectionRepository,
} from "../application/repository.ts";
import {
  draftAssetReferences,
  firstInvalidAsset,
  editCollection,
  isApprovedCreator,
  lockCreation,
} from "./guards.ts";
import { createDrizzleItemOperations } from "./drizzle-items.ts";
import { collectionRecord, itemRecord } from "./views.ts";

async function loadAggregate(
  database: Pick<DatabaseClient, "select">,
  ownerUserId: string,
  collectionId: string,
): Promise<CollectionAggregate | null> {
  const [row] = await database
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.id, collectionId),
        eq(collections.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  if (row === undefined) return null;
  const items = await database
    .select()
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId))
    .orderBy(asc(collectionItems.position));
  return { collection: collectionRecord(row), items: items.map(itemRecord) };
}

export function createDrizzleCollectionRepository(
  database: DatabaseClient,
): CollectionRepository {
  return {
    ...createDrizzleItemOperations(database),

    create(input) {
      return database.transaction(async (transaction) => {
        if (!(await isApprovedCreator(transaction, input.ownerUserId)))
          return { kind: "not-eligible" };
        await lockCreation(
          transaction,
          input.ownerUserId,
          input.idempotencyKey,
        );
        const [existing] = await transaction
          .select()
          .from(collections)
          .where(
            and(
              eq(collections.ownerUserId, input.ownerUserId),
              eq(collections.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1);
        if (existing !== undefined) {
          const aggregate = await loadAggregate(
            transaction,
            input.ownerUserId,
            existing.id,
          );
          return aggregate === null ||
            existing.requestFingerprint !== input.requestFingerprint
            ? { kind: "conflict" }
            : { aggregate, kind: "replayed" };
        }
        const invalid = await firstInvalidAsset(
          transaction,
          input.ownerUserId,
          draftAssetReferences(input.draft),
        );
        if (invalid !== null)
          return { assetId: invalid, kind: "invalid-asset" };
        await transaction.insert(collections).values({
          bannerAssetId: input.draft.bannerAssetId,
          chainId: input.draft.targetChain,
          coverAssetId: input.draft.coverAssetId,
          createdAt: input.changedAt,
          description: input.draft.description,
          id: input.collectionId,
          idempotencyKey: input.idempotencyKey,
          name: input.draft.name,
          ownerUserId: input.ownerUserId,
          plannedSupply: input.draft.plannedSupply,
          provenance: input.draft.provenance,
          requestFingerprint: input.requestFingerprint,
          updatedAt: input.changedAt,
        });
        const aggregate = await loadAggregate(
          transaction,
          input.ownerUserId,
          input.collectionId,
        );
        if (aggregate === null)
          throw new Error("Created collection is missing");
        return { aggregate, kind: "created" };
      });
    },

    find: ({ collectionId, ownerUserId }) =>
      loadAggregate(database, ownerUserId, collectionId),

    async listForOwner({ limit, ownerUserId }) {
      const rows = await database
        .select({
          collection: collections,
          itemCount: count(collectionItems.id),
        })
        .from(collections)
        .leftJoin(
          collectionItems,
          eq(collectionItems.collectionId, collections.id),
        )
        .where(eq(collections.ownerUserId, ownerUserId))
        .groupBy(collections.id)
        .orderBy(desc(collections.updatedAt), desc(collections.id))
        .limit(limit);
      return rows.map(({ collection, itemCount }) => {
        const record = collectionRecord(collection);
        return {
          createdAt: record.createdAt,
          id: record.id,
          itemCount,
          name: record.name,
          plannedSupply: record.plannedSupply,
          revision: record.revision,
          targetChain: record.targetChain,
          updatedAt: record.updatedAt,
        };
      });
    },

    save(input) {
      return editCollection(
        database,
        input.ownerUserId,
        input.collectionId,
        async (transaction, locked) => {
          if (locked.revision !== input.expectedRevision)
            return {
              currentRevision: locked.revision,
              kind: "revision-conflict",
            };
          const [{ itemCount = 0 } = {}] = await transaction
            .select({ itemCount: count() })
            .from(collectionItems)
            .where(eq(collectionItems.collectionId, input.collectionId));
          if (itemCount > input.draft.plannedSupply)
            return { itemCount, kind: "supply-below-items" };
          const invalid = await firstInvalidAsset(
            transaction,
            input.ownerUserId,
            draftAssetReferences(input.draft),
          );
          if (invalid !== null)
            return { assetId: invalid, kind: "invalid-asset" };
          await transaction
            .update(collections)
            .set({
              bannerAssetId: input.draft.bannerAssetId,
              chainId: input.draft.targetChain,
              coverAssetId: input.draft.coverAssetId,
              description: input.draft.description,
              name: input.draft.name,
              plannedSupply: input.draft.plannedSupply,
              provenance: input.draft.provenance,
              revision: locked.revision + 1,
              updatedAt: input.changedAt,
            })
            .where(eq(collections.id, input.collectionId));
          const aggregate = await loadAggregate(
            transaction,
            input.ownerUserId,
            input.collectionId,
          );
          if (aggregate === null)
            throw new Error("Saved collection is missing");
          return { aggregate, kind: "saved" };
        },
      );
    },
  };
}
