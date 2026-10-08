import {
  httpErrorEnvelopeSchema,
  idempotencyHeaderName,
  type IdempotencyKey,
} from "@ador/shared/http";
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
import { UploadApiError } from "./api-error.ts";

// The slice of a Zod schema this client needs, so the client does not depend on the schema library.
// `unknown` is the safe type for an untrusted response body; it is accepted only through a schema.
interface Parser<Output> {
  safeParse(
    value: unknown,
  ):
    | { readonly data: Output; readonly success: true }
    | { readonly success: false };
}

export type FetchLike = (
  input: string,
  init: {
    body?: string;
    headers: Record<string, string>;
    method: string;
    signal?: AbortSignal;
  },
) => Promise<Response>;

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

// The one place the browser talks to the uploads HTTP API. Every response is validated against the
// shared contract before it is returned, so callers only ever see typed data.
export function createUploadsApi(fetchImpl: FetchLike): UploadsApi {
  async function request<Output>(
    route: { readonly method: string; readonly path: string },
    schema: Parser<Output>,
    options: {
      readonly body?: object;
      readonly idempotencyKey?: IdempotencyKey;
      readonly signal?: AbortSignal;
    },
  ): Promise<Output> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined)
      headers["content-type"] = "application/json";
    if (options.idempotencyKey !== undefined)
      headers[idempotencyHeaderName] = options.idempotencyKey;
    let response: Response;
    try {
      response = await fetchImpl(route.path, {
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
        headers,
        method: route.method,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      });
    } catch (error) {
      // An abort is the caller's own doing and must stay distinguishable from a network failure.
      if (options.signal?.aborted === true) throw error;
      throw new UploadApiError(
        "network",
        null,
        "The request could not reach the server.",
      );
    }
    // The body is untrusted until a schema accepts it.
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const envelope = httpErrorEnvelopeSchema.safeParse(payload);
      if (envelope.success)
        throw new UploadApiError(
          envelope.data.error.code,
          response.status,
          envelope.data.error.message,
        );
      throw new UploadApiError(
        "invalid-response",
        response.status,
        "The server sent an unexpected error.",
      );
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success)
      throw new UploadApiError(
        "invalid-response",
        response.status,
        "The server sent an unexpected response.",
      );
    return parsed.data;
  }

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
