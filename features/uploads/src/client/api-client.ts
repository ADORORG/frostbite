import { createRequester, type FetchLike } from "@ador/client-http";
import type { IdempotencyKey } from "@ador/shared/http";
import {
  completedUploadResponseSchema,
  libraryOlderRoute,
  libraryResponseSchema,
  libraryRoute,
  uploadIntentResponseSchema,
  uploadIntentRoutes,
  type CompleteUploadIntentInput,
  type CompletedUploadResponse,
  type CreateUploadIntentInput,
  type LibraryResponse,
  type UploadIntentResponse,
} from "@ador/shared/uploads";

export type { FetchLike } from "@ador/client-http";

export interface UploadsApi {
  completeIntent(
    input: CompleteUploadIntentInput,
    options?: { readonly signal?: AbortSignal },
  ): Promise<CompletedUploadResponse>;
  createIntent(
    input: CreateUploadIntentInput,
    options: {
      readonly idempotencyKey: IdempotencyKey;
      readonly signal?: AbortSignal;
    },
  ): Promise<UploadIntentResponse>;
  listAssets(options?: {
    readonly signal?: AbortSignal;
  }): Promise<LibraryResponse>;
  // The page after the cursor an earlier answer gave.
  listOlderAssets(
    before: string,
    options?: { readonly signal?: AbortSignal },
  ): Promise<LibraryResponse>;
}

// The browser's view of the uploads HTTP API; requests and error handling are the shared requester's.
export function createUploadsApi(fetchImpl: FetchLike): UploadsApi {
  const request = createRequester(fetchImpl);
  return {
    completeIntent: (input, options = {}) =>
      request(uploadIntentRoutes.complete, completedUploadResponseSchema, {
        body: input,
        ...options,
      }),
    createIntent: (input, options) =>
      request(uploadIntentRoutes.create, uploadIntentResponseSchema, {
        body: input,
        ...options,
      }),
    listAssets: (options = {}) =>
      request(libraryRoute, libraryResponseSchema, options),
    listOlderAssets: (before, options = {}) =>
      request(libraryOlderRoute, libraryResponseSchema, {
        body: { before },
        ...options,
      }),
  };
}
