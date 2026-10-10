import { createRequester, type FetchLike } from "@ador/client-http";
import type { IdempotencyKey } from "@ador/shared/http";
import {
  completedUploadResponseSchema,
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
  };
}
