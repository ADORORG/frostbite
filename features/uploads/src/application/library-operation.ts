import type { HttpOperation } from "@ador/http";
import {
  libraryEmptyInputSchema,
  libraryResponseSchema,
  libraryRoute,
  type LibraryEmptyInput,
  type LibraryResponse,
} from "@ador/shared/uploads";
import type { createAssetLibraryService } from "@ador/uploads";

type Service = ReturnType<typeof createAssetLibraryService>;

// The caller's own assets with their processing outcome and short-lived signed rendition URLs
// (ADR-016). The actor comes from the session, never from the request.
export function createListUploadedAssetsOperation(
  getService: () => Promise<Service>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (_input, context) => {
      if (context.actorUserId === null)
        return {
          error: "unauthorized",
          message: "Authentication is required.",
          ok: false,
        } as const;
      return {
        ok: true,
        value: await (await getService()).list(context.actorUserId),
      } as const;
    },
    idempotency: "none",
    input: "none",
    inputSchema: libraryEmptyInputSchema,
    outputSchema: libraryResponseSchema,
    ...libraryRoute,
  } satisfies HttpOperation<LibraryEmptyInput, LibraryResponse>;
}
