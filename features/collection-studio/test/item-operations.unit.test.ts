import { describe, expect, it, vi } from "vitest";

import {
  createAddItemOperation,
  createRemoveItemOperation,
  createUpdateItemOperation,
} from "../src/application/item-operations.ts";
import {
  anonymous,
  context,
  id,
  itemRecord,
  stubService,
} from "./support/stubs.ts";

const item = {
  attributes: [{ trait: "Colour", value: "Blue" }],
  description: "",
  imageAssetId: id(),
  name: "Item",
};

describe("add item", () => {
  const input = { collectionId: id(), item };

  it("requires a session and the idempotency context before resolving the service", async () => {
    const getService = vi.fn(async () => stubService());
    const operation = createAddItemOperation(getService);
    expect(await operation.execute(input, anonymous)).toMatchObject({
      error: "unauthorized",
    });
    await expect(
      operation.execute(input, { ...context, idempotencyKey: undefined }),
    ).rejects.toThrow("Idempotency boundary missing");
    expect(getService).not.toHaveBeenCalled();
  });

  it.each(["added", "replayed"] as const)(
    "returns the item and new revision when %s",
    async (kind) => {
      const record = itemRecord(item.imageAssetId, 4);
      const addItem = vi.fn(async () => ({ item: record, kind, revision: 9 }));
      const result = await createAddItemOperation(async () =>
        stubService({ addItem }),
      ).execute(input, context);
      if (!result.ok) throw new Error(result.message);
      expect(addItem).toHaveBeenCalledWith({
        collectionId: input.collectionId,
        idempotencyKey: context.idempotencyKey,
        item,
        ownerUserId: context.actorUserId,
      });
      expect(result.value).toEqual({
        item: {
          attributes: [{ trait: "Colour", value: "Blue" }],
          description: "An item",
          id: record.id,
          imageAssetId: item.imageAssetId,
          name: "Item",
          position: 4,
        },
        revision: 9,
      });
    },
  );

  it.each([
    [{ kind: "conflict" }, "conflict"],
    [{ kind: "item-limit" }, "conflict"],
    [{ kind: "supply-reached" }, "conflict"],
    [{ assetId: "x", kind: "invalid-asset" }, "invalid_request"],
    [{ kind: "not-eligible" }, "forbidden"],
    [{ kind: "not-found" }, "not_found"],
  ] as const)("maps %j to %s", async (outcome, error) => {
    const result = await createAddItemOperation(async () =>
      stubService({ addItem: vi.fn(async () => outcome) }),
    ).execute(input, context);
    expect(result).toMatchObject({ error, ok: false });
  });
});

describe("update item", () => {
  const input = { collectionId: id(), item, itemId: id() };

  it("returns the updated item and the new revision", async () => {
    const record = itemRecord(item.imageAssetId, 2);
    const updateItem = vi.fn(async () => ({
      item: record,
      kind: "updated" as const,
      revision: 6,
    }));
    const operation = createUpdateItemOperation(async () =>
      stubService({ updateItem }),
    );
    expect(await operation.execute(input, anonymous)).toMatchObject({
      error: "unauthorized",
    });
    const result = await operation.execute(input, context);
    if (!result.ok) throw new Error(result.message);
    expect(result.value.revision).toBe(6);
    expect(updateItem).toHaveBeenCalledWith({
      collectionId: input.collectionId,
      item,
      itemId: input.itemId,
      ownerUserId: context.actorUserId,
    });
  });

  it.each([
    [{ assetId: "x", kind: "invalid-asset" }, "invalid_request"],
    [{ kind: "not-eligible" }, "forbidden"],
    [{ kind: "not-found" }, "not_found"],
  ] as const)("maps %j to %s", async (outcome, error) => {
    const result = await createUpdateItemOperation(async () =>
      stubService({ updateItem: vi.fn(async () => outcome) }),
    ).execute(input, context);
    expect(result).toMatchObject({ error, ok: false });
  });
});

describe("remove item", () => {
  const input = { collectionId: id(), itemId: id() };

  it("reports removal with the revision, and maps the failures", async () => {
    const removeItem = vi.fn(async () => ({
      kind: "removed" as const,
      revision: 7,
    }));
    const operation = createRemoveItemOperation(async () =>
      stubService({ removeItem }),
    );
    expect(await operation.execute(input, anonymous)).toMatchObject({
      error: "unauthorized",
    });
    expect(await operation.execute(input, context)).toEqual({
      ok: true,
      value: { removed: true, revision: 7 },
    });
    expect(removeItem).toHaveBeenCalledWith({
      ...input,
      ownerUserId: context.actorUserId,
    });
    for (const [outcome, error] of [
      [{ kind: "not-eligible" }, "forbidden"],
      [{ kind: "not-found" }, "not_found"],
    ] as const) {
      const result = await createRemoveItemOperation(async () =>
        stubService({ removeItem: vi.fn(async () => outcome) }),
      ).execute(input, context);
      expect(result).toMatchObject({ error, ok: false });
    }
  });
});
