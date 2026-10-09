import type { HttpOperation } from "@ador/http";
import {
  addCollectionItemInputSchema,
  collectionItemChangeSchema,
  collectionItemRemovedSchema,
  collectionRoutes,
  removeCollectionItemInputSchema,
  updateCollectionItemInputSchema,
  type AddCollectionItemInput,
  type CollectionItemChange,
  type CollectionItemRemoved,
  type RemoveCollectionItemInput,
  type UpdateCollectionItemInput,
} from "@ador/shared/collections";
import { uuidV7Schema } from "@ador/shared/identifiers";

import type { CollectionService } from "./dependencies.ts";
import { commonFailures, failure, unauthenticated } from "./outcome.ts";
import { presentItem } from "./present.ts";

type Resolve = () => Promise<CollectionService>;

export function createAddItemOperation(getService: Resolve) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: [
      "conflict",
      "forbidden",
      "invalid_request",
      "not_found",
      "unauthorized",
    ],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      if (context.idempotencyKey === undefined)
        throw new Error("Idempotency boundary missing");
      const result = await (
        await getService()
      ).addItem({
        collectionId: uuidV7Schema.parse(input.collectionId),
        idempotencyKey: context.idempotencyKey,
        item: input.item,
        ownerUserId: context.actorUserId,
      });
      if (result.kind === "added" || result.kind === "replayed")
        return {
          ok: true,
          value: { item: presentItem(result.item), revision: result.revision },
        } as const;
      if (result.kind === "conflict")
        return failure(
          "conflict",
          "The idempotency key conflicts with another request.",
        );
      if (result.kind === "item-limit")
        return failure(
          "conflict",
          "The collection has reached its item limit.",
        );
      if (result.kind === "supply-reached")
        return failure(
          "conflict",
          "The collection already has as many items as its planned supply.",
        );
      return commonFailures[result.kind];
    },
    idempotency: "required",
    input: "json",
    inputSchema: addCollectionItemInputSchema,
    outputSchema: collectionItemChangeSchema,
    ...collectionRoutes.addItem,
  } satisfies HttpOperation<AddCollectionItemInput, CollectionItemChange>;
}

export function createUpdateItemOperation(getService: Resolve) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: [
      "forbidden",
      "invalid_request",
      "not_found",
      "unauthorized",
    ],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const result = await (
        await getService()
      ).updateItem({
        collectionId: uuidV7Schema.parse(input.collectionId),
        item: input.item,
        itemId: uuidV7Schema.parse(input.itemId),
        ownerUserId: context.actorUserId,
      });
      if (result.kind === "updated")
        return {
          ok: true,
          value: { item: presentItem(result.item), revision: result.revision },
        } as const;
      return commonFailures[result.kind];
    },
    idempotency: "none",
    input: "json",
    inputSchema: updateCollectionItemInputSchema,
    outputSchema: collectionItemChangeSchema,
    ...collectionRoutes.updateItem,
  } satisfies HttpOperation<UpdateCollectionItemInput, CollectionItemChange>;
}

export function createRemoveItemOperation(getService: Resolve) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["forbidden", "not_found", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const result = await (
        await getService()
      ).removeItem({
        collectionId: uuidV7Schema.parse(input.collectionId),
        itemId: uuidV7Schema.parse(input.itemId),
        ownerUserId: context.actorUserId,
      });
      if (result.kind === "removed")
        return {
          ok: true,
          value: { removed: true, revision: result.revision },
        } as const;
      return commonFailures[result.kind];
    },
    idempotency: "none",
    input: "json",
    inputSchema: removeCollectionItemInputSchema,
    outputSchema: collectionItemRemovedSchema,
    ...collectionRoutes.removeItem,
  } satisfies HttpOperation<RemoveCollectionItemInput, CollectionItemRemoved>;
}
