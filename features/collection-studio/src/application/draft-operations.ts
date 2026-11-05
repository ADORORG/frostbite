import type { HttpOperation } from "@frostbite/http";
import {
  collectionDetailSchema,
  collectionListResponseSchema,
  collectionRoutes,
  createCollectionDraftInputSchema,
  listCollectionDraftsInputSchema,
  readCollectionDraftInputSchema,
  saveCollectionDraftInputSchema,
  type CollectionDetail,
  type CollectionListResponse,
  type CreateCollectionDraftInput,
  type ListCollectionDraftsInput,
  type ReadCollectionDraftInput,
  type SaveCollectionDraftInput,
} from "@frostbite/shared/collections";
import { uuidV7Schema } from "@frostbite/shared/identifiers";

import { detailOf, type OperationDependencies } from "./dependencies.ts";
import {
  commonFailures,
  failure,
  idempotencyKeyConflict,
  revisionConflict,
  unauthenticated,
} from "./outcome.ts";
import { presentSummary } from "./present.ts";

export function createCreateDraftOperation(
  dependencies: OperationDependencies,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: [
      "conflict",
      "forbidden",
      "invalid_request",
      "unauthorized",
    ],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      if (context.idempotencyKey === undefined)
        throw new Error("Idempotency boundary missing");
      const result = await (
        await dependencies.getService()
      ).create({
        draft: input,
        idempotencyKey: context.idempotencyKey,
        ownerUserId: context.actorUserId,
      });
      if (result.kind === "created" || result.kind === "replayed")
        return {
          ok: true,
          value: await detailOf(
            dependencies,
            context.actorUserId,
            result.aggregate,
          ),
        } as const;
      if (result.kind === "conflict") return idempotencyKeyConflict;
      return commonFailures[result.kind];
    },
    idempotency: "required",
    input: "json",
    inputSchema: createCollectionDraftInputSchema,
    outputSchema: collectionDetailSchema,
    ...collectionRoutes.create,
  } satisfies HttpOperation<CreateCollectionDraftInput, CollectionDetail>;
}

export function createListDraftsOperation(dependencies: OperationDependencies) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (_input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const records = await (
        await dependencies.getService()
      ).list(context.actorUserId);
      return {
        ok: true,
        value: { collections: records.map(presentSummary) },
      } as const;
    },
    idempotency: "none",
    input: "none",
    inputSchema: listCollectionDraftsInputSchema,
    outputSchema: collectionListResponseSchema,
    ...collectionRoutes.list,
    cache: { kind: "revalidate" },
  } satisfies HttpOperation<ListCollectionDraftsInput, CollectionListResponse>;
}

export function createReadDraftOperation(dependencies: OperationDependencies) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["not_found", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const aggregate = await (
        await dependencies.getService()
      ).find({
        collectionId: uuidV7Schema.parse(input.collectionId),
        ownerUserId: context.actorUserId,
      });
      if (aggregate === null) return commonFailures["not-found"];
      return {
        ok: true,
        value: await detailOf(dependencies, context.actorUserId, aggregate),
      } as const;
    },
    idempotency: "none",
    cache: { kind: "revalidate" },
    input: "query",
    inputSchema: readCollectionDraftInputSchema,
    outputSchema: collectionDetailSchema,
    ...collectionRoutes.read,
  } satisfies HttpOperation<ReadCollectionDraftInput, CollectionDetail>;
}

export function createSaveDraftOperation(dependencies: OperationDependencies) {
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
      const result = await (
        await dependencies.getService()
      ).save({
        collectionId: uuidV7Schema.parse(input.collectionId),
        draft: input.draft,
        expectedRevision: input.expectedRevision,
        ownerUserId: context.actorUserId,
      });
      if (result.kind === "saved")
        return {
          ok: true,
          value: await detailOf(
            dependencies,
            context.actorUserId,
            result.aggregate,
          ),
        } as const;
      if (result.kind === "revision-conflict") return revisionConflict;
      if (result.kind === "supply-below-items")
        return failure(
          "invalid_request",
          "The planned supply cannot be below the number of items already added.",
        );
      return commonFailures[result.kind];
    },
    idempotency: "none",
    input: "json",
    inputSchema: saveCollectionDraftInputSchema,
    outputSchema: collectionDetailSchema,
    ...collectionRoutes.save,
  } satisfies HttpOperation<SaveCollectionDraftInput, CollectionDetail>;
}
