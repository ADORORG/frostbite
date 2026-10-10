import {
  httpErrorEnvelopeSchema,
  idempotencyHeaderName,
  type IdempotencyKey,
} from "@ador/shared/http";

import { ApiError } from "./api-error.ts";

// The slice of a Zod schema this client needs, so the client does not depend on the schema library.
// `unknown` is the safe type for an untrusted response body; it is accepted only through a schema.
export interface Parser<Output> {
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

export interface Route {
  readonly method: string;
  readonly path: string;
}

export interface RequestOptions {
  readonly body?: object;
  readonly idempotencyKey?: IdempotencyKey;
  readonly signal?: AbortSignal;
}

export type Requester = <Output>(
  route: Route,
  schema: Parser<Output>,
  options?: RequestOptions,
) => Promise<Output>;

// The one way the browser talks to the platform's JSON API. Every response is validated against the
// shared contract before it is returned, so callers only ever see typed data, and every failure is an
// `ApiError` with a stable code. An abort is the caller's own doing and is rethrown unchanged.
export function createRequester(fetchImpl: FetchLike): Requester {
  return async (route, schema, options = {}) => {
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
      if (options.signal?.aborted === true) throw error;
      throw new ApiError(
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
        throw new ApiError(
          envelope.data.error.code,
          response.status,
          envelope.data.error.message,
        );
      throw new ApiError(
        "invalid-response",
        response.status,
        "The server sent an unexpected error.",
      );
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success)
      throw new ApiError(
        "invalid-response",
        response.status,
        "The server sent an unexpected response.",
      );
    return parsed.data;
  };
}

// Same-origin credentials for the browser's own `fetch`.
export const sameOriginFetch: FetchLike = (input, init) =>
  fetch(input, { ...init, credentials: "same-origin" });
