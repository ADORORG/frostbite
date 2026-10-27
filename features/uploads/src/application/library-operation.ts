import type { HttpOperation } from "@ador/http";
import {
  libraryEmptyInputSchema,
  libraryOlderInputSchema,
  libraryOlderRoute,
  libraryResponseSchema,
  libraryRoute,
  type LibraryEmptyInput,
  type LibraryOlderInput,
  type LibraryResponse,
} from "@ador/shared/uploads";
import type { createAssetLibraryService } from "@ador/uploads";

type Service = Pick<ReturnType<typeof createAssetLibraryService>, "list">;

const unauthenticated = {
  error: "unauthorized",
  message: "Authentication is required.",
  ok: false,
} as const;

// The caller's own assets with their processing outcome and short-lived signed rendition URLs
// (ADR-016). The actor comes from the session, never from the request.
export function createListUploadedAssetsOperation(
  getService: () => Promise<Service>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (_input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      return {
        ok: true,
        value: await (await getService()).list(context.actorUserId),
      } as const;
    },
    idempotency: "none",
    input: "none",
    inputSchema: libraryEmptyInputSchema,
    outputSchema: libraryResponseSchema,
    cache: { kind: "revalidate" },
    ...libraryRoute,
  } satisfies HttpOperation<LibraryEmptyInput, LibraryResponse>;
}

// The page of the caller's assets after a cursor an earlier answer gave. A cursor is only a place in the caller's own list: the
// query is still bound to the session's user, so no cursor reaches another person's assets.
export function createListOlderUploadedAssetsOperation(
  getService: () => Promise<Service>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async ({ before }, context) => {
      if (context.actorUserId === null) return unauthenticated;
      return {
        ok: true,
        value: await (await getService()).list(context.actorUserId, before),
      } as const;
    },
    idempotency: "none",
    cache: { kind: "revalidate" },
    input: "query",
    inputSchema: libraryOlderInputSchema,
    outputSchema: libraryResponseSchema,
    ...libraryOlderRoute,
  } satisfies HttpOperation<LibraryOlderInput, LibraryResponse>;
}
