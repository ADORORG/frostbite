import type { CollectionSummaryRecord } from "@ador/collections";
import { describe, expect, it, vi } from "vitest";

import type { LibraryAsset } from "@ador/shared/uploads";
import type {
  AssetPreviews,
  CollectionService,
} from "../src/application/dependencies.ts";
import {
  createCreateDraftOperation,
  createListDraftsOperation,
  createReadDraftOperation,
  createSaveDraftOperation,
} from "../src/application/draft-operations.ts";
import {
  aggregate,
  anonymous,
  context,
  id,
  itemRecord,
  preview,
  signet,
  stubDependencies,
  stubService,
} from "./support/stubs.ts";

const draftInput = {
  bannerAssetId: null,
  coverAssetId: null,
  description: "",
  name: "First light",
  plannedSupply: 5,
  provenance: "",
  targetChain: signet,
};

function setup(
  overrides: Partial<CollectionService> = {},
  assets: readonly LibraryAsset[] = [],
) {
  const previews = vi.fn<AssetPreviews["getMany"]>(async () => assets);
  return { ...stubDependencies(stubService(overrides), previews), previews };
}

describe("create draft", () => {
  it("requires a session and the idempotency context without touching the service", async () => {
    const { dependencies, getService } = setup();
    const operation = createCreateDraftOperation(dependencies);
    expect(await operation.execute(draftInput, anonymous)).toMatchObject({
      error: "unauthorized",
      ok: false,
    });
    await expect(
      operation.execute(draftInput, { ...context, idempotencyKey: undefined }),
    ).rejects.toThrow("Idempotency boundary missing");
    expect(getService).not.toHaveBeenCalled();
  });

  it("returns the detail with previews of the referenced images", async () => {
    const cover = id();
    const created = aggregate({ coverAssetId: cover }, [itemRecord(cover)]);
    const create = vi.fn(async () => ({
      aggregate: created,
      kind: "created" as const,
    }));
    const { dependencies, previews } = setup({ create }, [preview(cover)]);
    const result = await createCreateDraftOperation(dependencies).execute(
      draftInput,
      context,
    );
    if (!result.ok) throw new Error(result.message);
    expect(create).toHaveBeenCalledWith({
      draft: draftInput,
      idempotencyKey: context.idempotencyKey,
      ownerUserId: context.actorUserId,
    });
    expect(previews).toHaveBeenCalledWith(context.actorUserId, [cover]);
    expect(result.value.previews.map(({ id: assetId }) => assetId)).toEqual([
      cover,
    ]);
    expect(result.value.collection.createdAt).toBe("2026-10-09T12:00:00.000Z");
  });

  it("does not ask for previews when the draft references no image", async () => {
    const create = vi.fn(async () => ({
      aggregate: aggregate(),
      kind: "replayed" as const,
    }));
    const { dependencies, getPreviews } = setup({ create });
    const result = await createCreateDraftOperation(dependencies).execute(
      draftInput,
      context,
    );
    expect(result.ok).toBe(true);
    expect(getPreviews).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "conflict" }, "conflict"],
    [{ kind: "not-eligible" }, "forbidden"],
    [{ kind: "invalid-chain" }, "invalid_request"],
    [{ assetId: "x", kind: "invalid-asset" }, "invalid_request"],
    [{ kind: "not-found" }, "not_found"],
  ] as const)("maps %j to %s", async (outcome, error) => {
    const { dependencies } = setup({ create: vi.fn(async () => outcome) });
    expect(
      await createCreateDraftOperation(dependencies).execute(
        draftInput,
        context,
      ),
    ).toMatchObject({
      error,
      ok: false,
    });
  });
});

describe("list drafts", () => {
  it("requires a session and presents summaries", async () => {
    const record: CollectionSummaryRecord = {
      coverAssetId: null,
      createdAt: new Date("2026-10-09T12:00:00.000Z"),
      id: id(),
      itemCount: 2,
      name: "First light",
      plannedSupply: 5,
      revision: 3,
      submissionState: "changes-requested",
      targetChain: signet,
      updatedAt: new Date("2026-10-09T13:00:00.000Z"),
    };
    const list = vi.fn(async () => [record]);
    const { dependencies } = setup({ list });
    const operation = createListDraftsOperation(dependencies);
    expect(await operation.execute({}, anonymous)).toMatchObject({
      error: "unauthorized",
    });
    const result = await operation.execute({}, context);
    if (!result.ok) throw new Error(result.message);
    expect(list).toHaveBeenCalledWith(context.actorUserId);
    expect(result.value.collections).toEqual([
      {
        coverAssetId: null,
        createdAt: "2026-10-09T12:00:00.000Z",
        id: record.id,
        itemCount: 2,
        name: "First light",
        plannedSupply: 5,
        revision: 3,
        submissionState: "changes-requested",
        targetChain: signet,
        updatedAt: "2026-10-09T13:00:00.000Z",
      },
    ]);
  });
});

describe("read draft", () => {
  it("answers not found for an unknown or foreign draft", async () => {
    const { dependencies } = setup({ find: vi.fn(async () => null) });
    const operation = createReadDraftOperation(dependencies);
    expect(
      await operation.execute({ collectionId: id() }, anonymous),
    ).toMatchObject({
      error: "unauthorized",
    });
    expect(
      await operation.execute({ collectionId: id() }, context),
    ).toMatchObject({
      error: "not_found",
    });
  });

  it("returns each distinct referenced image once, in the detail", async () => {
    const shared = id();
    const found = aggregate({ coverAssetId: shared, bannerAssetId: id() }, [
      itemRecord(shared, 1),
      itemRecord(shared, 2),
    ]);
    const find = vi.fn(async () => found);
    const { dependencies, previews } = setup({ find });
    const result = await createReadDraftOperation(dependencies).execute(
      { collectionId: found.collection.id },
      context,
    );
    expect(result.ok).toBe(true);
    expect(previews.mock.calls[0]?.[1]).toHaveLength(2);
    expect(find).toHaveBeenCalledWith({
      collectionId: found.collection.id,
      ownerUserId: context.actorUserId,
    });
  });
});

describe("save draft", () => {
  const input = { collectionId: id(), draft: draftInput, expectedRevision: 2 };

  it("returns the saved detail", async () => {
    const save = vi.fn(async () => ({
      aggregate: aggregate({ revision: 3 }),
      kind: "saved" as const,
    }));
    const { dependencies } = setup({ save });
    const result = await createSaveDraftOperation(dependencies).execute(
      input,
      context,
    );
    if (!result.ok) throw new Error(result.message);
    expect(result.value.collection.revision).toBe(3);
    expect(save).toHaveBeenCalledWith({
      ...input,
      ownerUserId: context.actorUserId,
    });
  });

  it.each([
    [{ currentRevision: 5, kind: "revision-conflict" }, "conflict"],
    [{ itemCount: 4, kind: "supply-below-items" }, "invalid_request"],
    [{ kind: "invalid-chain" }, "invalid_request"],
    [{ assetId: "x", kind: "invalid-asset" }, "invalid_request"],
    [{ kind: "not-eligible" }, "forbidden"],
    [{ kind: "not-found" }, "not_found"],
  ] as const)("maps %j to %s", async (outcome, error) => {
    const { dependencies } = setup({ save: vi.fn(async () => outcome) });
    const operation = createSaveDraftOperation(dependencies);
    expect(await operation.execute(input, context)).toMatchObject({
      error,
      ok: false,
    });
    expect(await operation.execute(input, anonymous)).toMatchObject({
      error: "unauthorized",
    });
  });
});
