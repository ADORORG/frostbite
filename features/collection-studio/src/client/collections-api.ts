import { createRequester, type FetchLike } from "@ador/client-http";
import {
  collectionDetailSchema,
  collectionItemChangeSchema,
  collectionItemRemovedSchema,
  collectionListResponseSchema,
  collectionRoutes,
  type AddCollectionItemInput,
  type CollectionDetail,
  type CollectionItemChange,
  type CollectionItemRemoved,
  type CollectionListResponse,
  type CreateCollectionDraftInput,
  type RemoveCollectionItemInput,
  type SaveCollectionDraftInput,
  type UpdateCollectionItemInput,
} from "@ador/shared/collections";
import type { IdempotencyKey } from "@ador/shared/http";
import {
  libraryResponseSchema,
  libraryRoute,
  type LibraryResponse,
} from "@ador/shared/uploads";

export interface CallOptions {
  readonly signal?: AbortSignal;
}

export interface CollectionsApi {
  addItem(
    input: AddCollectionItemInput,
    options: CallOptions & { readonly idempotencyKey: IdempotencyKey },
  ): Promise<CollectionItemChange>;
  create(
    input: CreateCollectionDraftInput,
    options: CallOptions & { readonly idempotencyKey: IdempotencyKey },
  ): Promise<CollectionDetail>;
  list(options?: CallOptions): Promise<CollectionListResponse>;
  // The creator's own uploads, for choosing images. This is the uploads feature's public contract.
  listImages(options?: CallOptions): Promise<LibraryResponse>;
  read(collectionId: string, options?: CallOptions): Promise<CollectionDetail>;
  removeItem(
    input: RemoveCollectionItemInput,
    options?: CallOptions,
  ): Promise<CollectionItemRemoved>;
  save(
    input: SaveCollectionDraftInput,
    options?: CallOptions,
  ): Promise<CollectionDetail>;
  updateItem(
    input: UpdateCollectionItemInput,
    options?: CallOptions,
  ): Promise<CollectionItemChange>;
}

// The browser's view of the collection studio API; requests and error handling are the shared
// requester's, so every response is validated against the shared contract.
export function createCollectionsApi(fetchImpl: FetchLike): CollectionsApi {
  const request = createRequester(fetchImpl);
  return {
    addItem: (input, options) =>
      request(collectionRoutes.addItem, collectionItemChangeSchema, {
        body: input,
        ...options,
      }),
    create: (input, options) =>
      request(collectionRoutes.create, collectionDetailSchema, {
        body: input,
        ...options,
      }),
    list: (options = {}) =>
      request(collectionRoutes.list, collectionListResponseSchema, options),
    listImages: (options = {}) =>
      request(libraryRoute, libraryResponseSchema, options),
    read: (collectionId, options = {}) =>
      request(collectionRoutes.read, collectionDetailSchema, {
        body: { collectionId },
        ...options,
      }),
    removeItem: (input, options = {}) =>
      request(collectionRoutes.removeItem, collectionItemRemovedSchema, {
        body: input,
        ...options,
      }),
    save: (input, options = {}) =>
      request(collectionRoutes.save, collectionDetailSchema, {
        body: input,
        ...options,
      }),
    updateItem: (input, options = {}) =>
      request(collectionRoutes.updateItem, collectionItemChangeSchema, {
        body: input,
        ...options,
      }),
  };
}

export type { FetchLike } from "@ador/client-http";
