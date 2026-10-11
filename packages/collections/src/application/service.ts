import type { ChainOption } from "@ador/shared/chain";
import {
  collectionDraftSchema,
  collectionItemSchema,
  collectionLimits,
  importCollectionItemsInputSchema,
  type CollectionDraft,
  type CollectionImportRow,
  type CollectionItem,
} from "@ador/shared/collections";
import { idempotencyKeySchema, requestFingerprint } from "@ador/shared/http";
import type { UuidV7 } from "@ador/shared/identifiers";

import type {
  AddItemResult,
  CollectionAggregate,
  CollectionRepository,
  CollectionSummaryRecord,
  CreateResult,
  ImportItemsResult,
  RemoveItemResult,
  SaveResult,
  UpdateItemResult,
} from "./repository.ts";

export interface CollectionServiceDependencies {
  readonly clock: () => Date;
  readonly createId: () => UuidV7;
  readonly listLimit: number;
  readonly repository: CollectionRepository;
  // The chains a draft may target: the enabled ones from validated configuration (ADR-017).
  readonly targetChains: readonly ChainOption[];
}

export interface IdempotentRequest {
  readonly idempotencyKey: string;
  readonly ownerUserId: UuidV7;
}

export type InvalidChain = { readonly kind: "invalid-chain" };

// Validates a draft, enforces the target-chain rule, and delegates persistence. The repository owns
// every invariant that depends on stored state (ownership, eligibility, asset references, limits).
export function createCollectionService(
  dependencies: CollectionServiceDependencies,
) {
  const enabledChains = new Set<string>(
    dependencies.targetChains
      .filter(({ enabled }) => enabled)
      .map(({ chainId }) => chainId),
  );
  const acceptsChain = (draft: CollectionDraft): boolean =>
    enabledChains.has(draft.targetChain);

  return {
    async addItem(
      input: {
        readonly collectionId: UuidV7;
        readonly item: CollectionItem;
      } & IdempotentRequest,
    ): Promise<AddItemResult> {
      const item = collectionItemSchema.parse(input.item);
      return dependencies.repository.addItem({
        changedAt: dependencies.clock(),
        collectionId: input.collectionId,
        idempotencyKey: idempotencyKeySchema.parse(input.idempotencyKey),
        item,
        itemId: dependencies.createId(),
        itemLimit: collectionLimits.itemsPerCollection,
        ownerUserId: input.ownerUserId,
        requestFingerprint: requestFingerprint({
          collectionId: input.collectionId,
          item,
          operation: "add-item",
        }),
      });
    },

    async create(
      input: { readonly draft: CollectionDraft } & IdempotentRequest,
    ): Promise<CreateResult | InvalidChain> {
      const draft = collectionDraftSchema.parse(input.draft);
      if (!acceptsChain(draft)) return { kind: "invalid-chain" };
      return dependencies.repository.create({
        changedAt: dependencies.clock(),
        collectionId: dependencies.createId(),
        draft,
        idempotencyKey: idempotencyKeySchema.parse(input.idempotencyKey),
        ownerUserId: input.ownerUserId,
        requestFingerprint: requestFingerprint({
          draft,
          operation: "create",
        }),
      });
    },

    find(input: {
      readonly collectionId: UuidV7;
      readonly ownerUserId: UuidV7;
    }): Promise<CollectionAggregate | null> {
      return dependencies.repository.find(input);
    },

    // Adds a list of items in one step, or none of them. The rows name their images by file name.
    async importItems(
      input: {
        readonly collectionId: UuidV7;
        readonly dryRun: boolean;
        readonly rows: readonly CollectionImportRow[];
      } & IdempotentRequest,
    ): Promise<ImportItemsResult> {
      const rows = importCollectionItemsInputSchema.shape.rows.parse(
        input.rows,
      );
      return dependencies.repository.importItems({
        changedAt: dependencies.clock(),
        collectionId: input.collectionId,
        dryRun: input.dryRun,
        idempotencyKey: idempotencyKeySchema.parse(input.idempotencyKey),
        itemLimit: collectionLimits.itemsPerCollection,
        ownerUserId: input.ownerUserId,
        requestFingerprint: requestFingerprint({
          collectionId: input.collectionId,
          operation: "import-items",
          rows,
        }),
        rows: rows.map((row) => ({ itemId: dependencies.createId(), row })),
      });
    },

    list(ownerUserId: UuidV7): Promise<readonly CollectionSummaryRecord[]> {
      return dependencies.repository.listForOwner({
        limit: dependencies.listLimit,
        ownerUserId,
      });
    },

    removeItem(input: {
      readonly collectionId: UuidV7;
      readonly itemId: UuidV7;
      readonly ownerUserId: UuidV7;
    }): Promise<RemoveItemResult> {
      return dependencies.repository.removeItem({
        ...input,
        changedAt: dependencies.clock(),
      });
    },

    async save(input: {
      readonly collectionId: UuidV7;
      readonly draft: CollectionDraft;
      readonly expectedRevision: number;
      readonly ownerUserId: UuidV7;
    }): Promise<SaveResult | InvalidChain> {
      const draft = collectionDraftSchema.parse(input.draft);
      if (!acceptsChain(draft)) return { kind: "invalid-chain" };
      return dependencies.repository.save({
        ...input,
        changedAt: dependencies.clock(),
        draft,
      });
    },

    async updateItem(input: {
      readonly collectionId: UuidV7;
      readonly item: CollectionItem;
      readonly itemId: UuidV7;
      readonly ownerUserId: UuidV7;
    }): Promise<UpdateItemResult> {
      return dependencies.repository.updateItem({
        ...input,
        changedAt: dependencies.clock(),
        item: collectionItemSchema.parse(input.item),
      });
    },
  };
}
