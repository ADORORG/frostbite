import { createHash } from "node:crypto";

import { correlationHeaderName } from "@ador/shared/http";

import { cacheControl, type HttpCachePolicy } from "./cache.ts";
import type { HttpAdapterResponse, HttpFile } from "./operation.ts";

// An answer as it is put on the wire: the bytes (none for "unchanged"), the status and every header.
export interface PresentedResponse {
  readonly body: Uint8Array | null;
  readonly headers: Readonly<Record<string, string>>;
  readonly status: number;
}

export interface PresentContext {
  readonly cache: HttpCachePolicy | undefined;
  // Whether the operation answers with a file (see `HttpOperation.files`).
  readonly file: boolean;
  // The request's If-None-Match, if it sent one.
  readonly ifNoneMatch: string | undefined;
  // Whether the answer depends on who asks (the operation is not open to everyone).
  readonly scope: "private" | "public";
}

const encoder = new TextEncoder();

// The output of a file operation was checked against its schema, but the schema's type is `object`: this tells the compiler too.
function isFile(body: object): body is HttpFile {
  return (
    "bytes" in body &&
    body.bytes instanceof Uint8Array &&
    "contentType" in body &&
    typeof body.contentType === "string"
  );
}

// A strong validator of exactly these bytes.
export const entityTag = (bytes: Uint8Array): string =>
  `"${createHash("sha256").update(bytes).digest("base64url")}"`;

// Whether an If-None-Match header names this tag. Weak comparison (RFC 9110 §13.1.2): a `W/` prefix is ignored, `*` matches
// anything.
export function matchesEntityTag(header: string, tag: string): boolean {
  return header
    .split(",")
    .map((candidate) => candidate.trim().replace(/^W\//u, ""))
    .some((candidate) => candidate === "*" || candidate === tag);
}

// The cache headers belong to the answer, not to the operation's code: only a successful read with a policy is kept at all,
// and an error, a write or an answer with no policy is `no-store`. An answer that depends on who asks says so (`Vary: Cookie`), so a
// browser shared by two people never shows one the other's.
export function presentResponse(
  response: HttpAdapterResponse<object>,
  context: PresentContext,
): PresentedResponse {
  const file =
    context.file && response.status === 200 && isFile(response.body)
      ? response.body
      : null;
  const bytes =
    file === null ? encoder.encode(JSON.stringify(response.body)) : file.bytes;
  const headers: Record<string, string> = {
    ...response.headers,
    "content-type": file?.contentType ?? "application/json",
    "x-content-type-options": "nosniff",
    // A drawing opened on its own address runs nothing and loads nothing.
    ...(file === null
      ? {}
      : { "content-security-policy": "sandbox; default-src 'none'" }),
  };
  const { cache } = context;
  if (
    response.status !== 200 ||
    cache === undefined ||
    cache.kind === "no-store"
  )
    return {
      body: bytes,
      headers: { ...headers, "cache-control": "no-store" },
      status: response.status,
    };
  const tag = entityTag(bytes);
  const kept = {
    "cache-control": cacheControl(cache, context.scope),
    etag: tag,
    ...(context.scope === "private" ? { vary: "Cookie" } : {}),
  };
  if (
    context.ifNoneMatch !== undefined &&
    matchesEntityTag(context.ifNoneMatch, tag)
  )
    return {
      body: null,
      headers: {
        ...kept,
        [correlationHeaderName]: response.headers[correlationHeaderName],
      },
      status: 304,
    };
  return { body: bytes, headers: { ...headers, ...kept }, status: 200 };
}
