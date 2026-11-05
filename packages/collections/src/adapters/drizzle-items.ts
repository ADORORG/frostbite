import type { DatabaseClient } from "@frostbite/database/connection";
import { collectionItems } from "@frostbite/database/schema/collections";
import { collectionAssetPurposes } from "@frostbite/shared/collections";
import { and, count, eq, max } from "drizzle-orm";

import type { CollectionRepository } from "../application/repository.ts";
import { bump, editCollection, firstInvalidAsset } from "./guards.ts";
import { itemRecord } from "./views.ts";

const itemPurpose = collectionAssetPurposes.item;

// The item operations. Each runs in one transaction that locks the collection row, so item changes
// and draft saves of one collection are serialised, and every change bumps the collection revision.
export function createDrizzleItemOperations(
  database: DatabaseClient,
): Pick<CollectionRepository, "addItem" | "removeItem" | "updateItem"> {
  return {
    addItem(input) {
      return editCollection(
        database,
        input.ownerUserId,
        input.collectionId,
        async (transaction, locked) => {
          const [repeated] = await transaction
            .select()
            .from(collectionItems)
            .where(
              and(
                eq(collectionItems.collectionId, input.collectionId),
                eq(collectionItems.idempotencyKey, input.idempotencyKey),
              ),
            )
            .limit(1);
          if (repeated !== undefined)
            return repeated.requestFingerprint === input.requestFingerprint
              ? {
                  item: itemRecord(repeated),
                  kind: "replayed",
                  revision: locked.revision,
                }
              : { kind: "conflict" };
          const [{ itemCount = 0, lastPosition = 0 } = {}] = await transaction
            .select({
              itemCount: count(),
              lastPosition: max(collectionItems.position),
            })
            .from(collectionItems)
            .where(eq(collectionItems.collectionId, input.collectionId));
          if (itemCount >= input.itemLimit) return { kind: "item-limit" };
          if (itemCount >= locked.plannedSupply)
            return { kind: "supply-reached" };
          const invalid = await firstInvalidAsset(
            transaction,
            input.ownerUserId,
            [{ id: input.item.imageAssetId, purpose: itemPurpose }],
          );
          if (invalid !== null)
            return { assetId: invalid, kind: "invalid-asset" };
          const [row] = await transaction
            .insert(collectionItems)
            .values({
              attributes: input.item.attributes,
              collectionId: input.collectionId,
              createdAt: input.changedAt,
              description: input.item.description,
              id: input.itemId,
              idempotencyKey: input.idempotencyKey,
              imageAssetId: input.item.imageAssetId,
              name: input.item.name,
              position: (lastPosition ?? 0) + 1,
              requestFingerprint: input.requestFingerprint,
              updatedAt: input.changedAt,
            })
            .returning();
          if (row === undefined) throw new Error("Inserted item is missing");
          return {
            item: itemRecord(row),
            kind: "added",
            revision: await bump(transaction, locked, input.changedAt),
          };
        },
      );
    },

    removeItem(input) {
      return editCollection(
        database,
        input.ownerUserId,
        input.collectionId,
        async (transaction, locked) => {
          const removed = await transaction
            .delete(collectionItems)
            .where(
              and(
                eq(collectionItems.id, input.itemId),
                eq(collectionItems.collectionId, input.collectionId),
              ),
            )
            .returning({ id: collectionItems.id });
          // Removing what is already gone is a success that changes nothing.
          const revision =
            removed.length > 0
              ? await bump(transaction, locked, input.changedAt)
              : locked.revision;
          return { kind: "removed", revision };
        },
      );
    },

    updateItem(input) {
      return editCollection(
        database,
        input.ownerUserId,
        input.collectionId,
        async (transaction, locked) => {
          const [existing] = await transaction
            .select({ id: collectionItems.id })
            .from(collectionItems)
            .where(
              and(
                eq(collectionItems.id, input.itemId),
                eq(collectionItems.collectionId, input.collectionId),
              ),
            )
            .limit(1);
          if (existing === undefined) return { kind: "not-found" };
          const invalid = await firstInvalidAsset(
            transaction,
            input.ownerUserId,
            [{ id: input.item.imageAssetId, purpose: itemPurpose }],
          );
          if (invalid !== null)
            return { assetId: invalid, kind: "invalid-asset" };
          const [row] = await transaction
            .update(collectionItems)
            .set({
              attributes: input.item.attributes,
              description: input.item.description,
              imageAssetId: input.item.imageAssetId,
              name: input.item.name,
              updatedAt: input.changedAt,
            })
            .where(eq(collectionItems.id, input.itemId))
            .returning();
          if (row === undefined) throw new Error("Updated item is missing");
          return {
            item: itemRecord(row),
            kind: "updated",
            revision: await bump(transaction, locked, input.changedAt),
          };
        },
      );
    },
  };
}
