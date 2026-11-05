import type { HttpOperation } from "@frostbite/http";
import {
  collectionImportResponseSchema,
  collectionImportRoute,
  importCollectionItemsInputSchema,
  type CollectionImportResponse,
  type ImportCollectionItemsInput,
} from "@frostbite/shared/collections";
import { uuidV7Schema } from "@frostbite/shared/identifiers";

import type { ImportRowReport } from "@frostbite/collections";
import type { CollectionService } from "./dependencies.ts";
import {
  commonFailures,
  failure,
  idempotencyKeyConflict,
  unauthenticated,
} from "./outcome.ts";

// The wire shape has plain arrays; the service's report is read-only.
const presentRows = (rows: readonly ImportRowReport[]) =>
  rows.map((row) => ({ ...row, problems: [...row.problems] }));

const answer = (value: CollectionImportResponse) =>
  ({ ok: true, value }) as const;

// Adds a creator's whole list of items, or tells them row by row why it cannot. A report with problems
// is an answer, not an error: the creator fixes the file and sends it again. A dry run is the same
// request that writes nothing.
export function createImportItemsOperation(
  getService: () => Promise<CollectionService>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: [
      "conflict",
      "forbidden",
      "invalid_request",
      "not_found",
      "unauthorized",
    ],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      if (context.idempotencyKey === undefined)
        throw new Error("Idempotency boundary missing");
      const result = await (
        await getService()
      ).importItems({
        collectionId: uuidV7Schema.parse(input.collectionId),
        dryRun: input.dryRun,
        idempotencyKey: context.idempotencyKey,
        ownerUserId: context.actorUserId,
        rows: input.rows,
      });
      if (result.kind === "imported" || result.kind === "replayed")
        return answer({
          imported: true,
          revision: result.revision,
          rows: presentRows(result.rows),
        });
      if (result.kind === "report")
        return answer({
          imported: false,
          revision: null,
          rows: presentRows(result.rows),
        });
      if (result.kind === "conflict") return idempotencyKeyConflict;
      if (result.kind === "item-limit")
        return failure(
          "conflict",
          "The collection would go past its item limit.",
        );
      return commonFailures[result.kind];
    },
    idempotency: "required",
    input: "json",
    inputSchema: importCollectionItemsInputSchema,
    outputSchema: collectionImportResponseSchema,
    ...collectionImportRoute,
  } satisfies HttpOperation<
    ImportCollectionItemsInput,
    CollectionImportResponse
  >;
}
