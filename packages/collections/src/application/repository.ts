import type { IdempotencyKey } from "@frostbite/shared/http";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import type {
  CollectionDraft,
  CollectionImportProblem as ImportProblem,
  CollectionImportRow,
  CollectionItem,
  SubmissionState,
} from "@frostbite/shared/collections";

export interface CollectionRecord extends CollectionDraft {
  readonly createdAt: Date;
  readonly id: UuidV7;
  readonly revision: number;
  readonly updatedAt: Date;
}

export interface CollectionItemRecord extends CollectionItem {
  readonly id: UuidV7;
  readonly position: number;
}

export interface CollectionAggregate {
  readonly collection: CollectionRecord;
  readonly items: readonly CollectionItemRecord[];
}

export interface CollectionSummaryRecord {
  readonly coverAssetId: CollectionRecord["coverAssetId"];
  readonly createdAt: Date;
  readonly id: UuidV7;
  readonly itemCount: number;
  readonly name: string;
  readonly plannedSupply: number;
  readonly revision: number;
  // The latest submission's state, or null if the collection was never submitted.
  readonly submissionState: SubmissionState | null;
  readonly targetChain: CollectionDraft["targetChain"];
  readonly updatedAt: Date;
}

// Every failure a mutation can report without throwing. `not-found` also covers another creator's
// collection, so a draft's existence is not disclosed. `not-eligible` means the caller is not an
// approved creator (never admitted, or suspended or revoked since).
export type CommonFailure =
  | { readonly kind: "invalid-asset"; readonly assetId: string }
  | { readonly kind: "not-eligible" }
  | { readonly kind: "not-found" };

interface Mutation {
  readonly changedAt: Date;
  readonly ownerUserId: UuidV7;
}

// Mutations that can be retried carry an idempotency key and a fingerprint of their content.
interface RetryableMutation extends Mutation {
  readonly idempotencyKey: IdempotencyKey;
  readonly requestFingerprint: string;
}

// The collection's revision after the change: item changes bump it, so a client that goes on to
// save the draft needs the new value.
interface ItemChange<Kind extends string> {
  readonly item: CollectionItemRecord;
  readonly kind: Kind;
  readonly revision: number;
}

export type CreateResult =
  | CommonFailure
  | { readonly kind: "conflict" }
  | { readonly aggregate: CollectionAggregate; readonly kind: "created" }
  | { readonly aggregate: CollectionAggregate; readonly kind: "replayed" };

export type SaveResult =
  | CommonFailure
  | { readonly aggregate: CollectionAggregate; readonly kind: "saved" }
  | { readonly currentRevision: number; readonly kind: "revision-conflict" }
  | { readonly itemCount: number; readonly kind: "supply-below-items" };

export type AddItemResult =
  | CommonFailure
  | { readonly kind: "conflict" }
  | { readonly kind: "item-limit" }
  | { readonly kind: "supply-reached" }
  | ItemChange<"added">
  | ItemChange<"replayed">;

export interface ImportRowReport {
  readonly imageAssetId: UuidV7 | null;
  readonly problems: readonly ImportProblem[];
  // 1-based, in the order sent.
  readonly row: number;
}

export type ImportItemsResult =
  | CommonFailure
  | { readonly kind: "conflict" }
  | { readonly kind: "item-limit" }
  // Nothing was written: a dry run, or rows that cannot be imported yet. Each row says why.
  | { readonly kind: "report"; readonly rows: readonly ImportRowReport[] }
  | {
      readonly kind: "imported" | "replayed";
      readonly revision: number;
      readonly rows: readonly ImportRowReport[];
    };

export type UpdateItemResult = CommonFailure | ItemChange<"updated">;

export type RemoveItemResult =
  CommonFailure | { readonly kind: "removed"; readonly revision: number };

export interface CollectionRepository {
  addItem(
    input: RetryableMutation & {
      readonly collectionId: UuidV7;
      readonly item: CollectionItem;
      readonly itemId: UuidV7;
      readonly itemLimit: number;
    },
  ): Promise<AddItemResult>;
  create(
    input: RetryableMutation & {
      readonly collectionId: UuidV7;
      readonly draft: CollectionDraft;
    },
  ): Promise<CreateResult>;
  // The caller's own collection with its items in order, or null. Never another creator's.
  find(input: {
    readonly collectionId: UuidV7;
    readonly ownerUserId: UuidV7;
  }): Promise<CollectionAggregate | null>;
  // Adds every row, in order, or none: rows whose image cannot be found, or that do not fit the planned
  // supply, stop the whole import. With `dryRun` it only reports.
  importItems(
    input: RetryableMutation & {
      readonly collectionId: UuidV7;
      readonly dryRun: boolean;
      readonly itemLimit: number;
      // The rows in the order they will be added, each with the identifier its item will have.
      readonly rows: readonly {
        readonly itemId: UuidV7;
        readonly row: CollectionImportRow;
      }[];
    },
  ): Promise<ImportItemsResult>;
  listForOwner(input: {
    readonly limit: number;
    readonly ownerUserId: UuidV7;
  }): Promise<readonly CollectionSummaryRecord[]>;
  removeItem(
    input: Mutation & {
      readonly collectionId: UuidV7;
      readonly itemId: UuidV7;
    },
  ): Promise<RemoveItemResult>;
  save(
    input: Mutation & {
      readonly collectionId: UuidV7;
      readonly draft: CollectionDraft;
      readonly expectedRevision: number;
    },
  ): Promise<SaveResult>;
  updateItem(
    input: Mutation & {
      readonly collectionId: UuidV7;
      readonly item: CollectionItem;
      readonly itemId: UuidV7;
    },
  ): Promise<UpdateItemResult>;
}
