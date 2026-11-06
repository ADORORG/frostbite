import {
  ApiError,
  createRequester,
  type FetchLike,
} from "@frostbite/client-http";
import {
  collectionDetailSchema,
  collectionImportResponseSchema,
  collectionImportRoute,
  collectionItemChangeSchema,
  collectionItemRemovedSchema,
  collectionListResponseSchema,
  collectionRoutes,
  collectionSubmissionListSchema,
  collectionSubmissionResponseSchema,
  submissionRoutes,
  type AddCollectionItemInput,
  type CollectionDetail,
  type CollectionImportResponse,
  type CollectionItemChange,
  type CollectionItemRemoved,
  type CollectionListResponse,
  type CollectionSubmissionList,
  type CollectionSubmissionResponse,
  type CreateCollectionDraftInput,
  type ImportCollectionItemsInput,
  type RemoveCollectionItemInput,
  type SaveCollectionDraftInput,
  type SubmitCollectionInput,
  type UpdateCollectionItemInput,
} from "@frostbite/shared/collections";
import {
  creatorApplicationResponseSchema,
  creatorApplicationRoutes,
  type CreatorApplicationState,
} from "@frostbite/shared/creator-admission";
import type { IdempotencyKey } from "@frostbite/shared/http";
import {
  libraryResponseSchema,
  libraryRoute,
  type LibraryResponse,
} from "@frostbite/shared/uploads";

// The state of the caller's creator application; `state` is null if they never applied. An object, so a
// person who never applied is an answer that has arrived, not an absence of one.
export interface CreatorStanding {
  readonly state: CreatorApplicationState | null;
}

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
  creatorStanding(options?: CallOptions): Promise<CreatorStanding>;
  // Adds a list of items in one step, or reports row by row why it cannot; `dryRun` only reports.
  importItems(
    input: ImportCollectionItemsInput,
    options: CallOptions & { readonly idempotencyKey: IdempotencyKey },
  ): Promise<CollectionImportResponse>;
  list(options?: CallOptions): Promise<CollectionListResponse>;
  // The creator's own uploads, for choosing images. This is the uploads feature's public contract.
  listImages(options?: CallOptions): Promise<LibraryResponse>;
  read(collectionId: string, options?: CallOptions): Promise<CollectionDetail>;
  listSubmissions(
    collectionId: string,
    options?: CallOptions,
  ): Promise<CollectionSubmissionList>;
  removeItem(
    input: RemoveCollectionItemInput,
    options?: CallOptions,
  ): Promise<CollectionItemRemoved>;
  save(
    input: SaveCollectionDraftInput,
    options?: CallOptions,
  ): Promise<CollectionDetail>;
  submit(
    input: SubmitCollectionInput,
    options: CallOptions & { readonly idempotencyKey: IdempotencyKey },
  ): Promise<CollectionSubmissionResponse>;
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
    creatorStanding: async (options = {}) => {
      try {
        const { application } = await request(
          creatorApplicationRoutes.mine,
          creatorApplicationResponseSchema,
          options,
        );
        return { state: application.state };
      } catch (error) {
        // Never having applied is an answer, not a failure.
        if (error instanceof ApiError && error.code === "not_found")
          return { state: null };
        throw error;
      }
    },
    importItems: (input, options) =>
      request(collectionImportRoute, collectionImportResponseSchema, {
        body: input,
        ...options,
      }),
    list: (options = {}) =>
      request(collectionRoutes.list, collectionListResponseSchema, options),
    listImages: (options = {}) =>
      request(libraryRoute, libraryResponseSchema, options),
    listSubmissions: (collectionId, options = {}) =>
      request(submissionRoutes.list, collectionSubmissionListSchema, {
        query: { collectionId },
        ...options,
      }),
    read: (collectionId, options = {}) =>
      request(collectionRoutes.read, collectionDetailSchema, {
        query: { collectionId },
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
    submit: (input, options) =>
      request(submissionRoutes.submit, collectionSubmissionResponseSchema, {
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

export type { FetchLike } from "@frostbite/client-http";
