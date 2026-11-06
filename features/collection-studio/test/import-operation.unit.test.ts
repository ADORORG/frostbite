import {
  collectionImportResponseSchema,
  importCollectionItemsInputSchema,
} from "@frostbite/shared/collections";
import { describe, expect, it, vi } from "vitest";

import { createImportItemsOperation } from "../src/application/import-operation.ts";
import { anonymous, context, id, stubService } from "./support/stubs.ts";

const row = {
  attributes: [{ trait: "Colour", value: "Blue" }],
  description: "",
  imageFileName: "a.png",
  name: "A",
};
const input = { collectionId: id(), dryRun: false, rows: [row] };
const reported = [
  { imageAssetId: id(), problems: ["over-supply" as const], row: 1 },
];

describe("import items operation", () => {
  it("requires a session and the idempotency context before resolving the service", async () => {
    const getService = vi.fn(async () => stubService());
    const operation = createImportItemsOperation(getService);
    expect(await operation.execute(input, anonymous)).toMatchObject({
      error: "unauthorized",
    });
    await expect(
      operation.execute(input, { ...context, idempotencyKey: undefined }),
    ).rejects.toThrow("Idempotency boundary missing");
    expect(getService).not.toHaveBeenCalled();
  });

  it("asks the service as the signed-in creator, never as anyone the request names", async () => {
    const importItems = vi.fn(async () => ({
      kind: "imported" as const,
      revision: 3,
      rows: [],
    }));
    await createImportItemsOperation(async () =>
      stubService({ importItems }),
    ).execute({ ...input, dryRun: true }, context);
    expect(importItems).toHaveBeenCalledExactlyOnceWith({
      collectionId: input.collectionId,
      dryRun: true,
      idempotencyKey: context.idempotencyKey,
      ownerUserId: context.actorUserId,
      rows: [row],
    });
  });

  it.each(["imported", "replayed"] as const)(
    "answers that the items were added when %s",
    async (kind) => {
      const result = await createImportItemsOperation(async () =>
        stubService({
          importItems: vi.fn(async () => ({
            kind,
            revision: 4,
            rows: [{ imageAssetId: id(), problems: [], row: 1 }],
          })),
        }),
      ).execute(input, context);
      if (!result.ok) throw new Error(result.message);
      expect(result.value).toMatchObject({ imported: true, revision: 4 });
      expect(() =>
        collectionImportResponseSchema.parse(result.value),
      ).not.toThrow();
    },
  );

  it("answers a report as an answer, with nothing added and no new revision", async () => {
    const result = await createImportItemsOperation(async () =>
      stubService({
        importItems: vi.fn(async () => ({
          kind: "report" as const,
          rows: reported,
        })),
      }),
    ).execute(input, context);
    expect(result).toEqual({
      ok: true,
      value: { imported: false, revision: null, rows: reported },
    });
  });

  it.each([
    [{ kind: "conflict" }, "conflict"],
    [{ kind: "item-limit" }, "conflict"],
    [{ assetId: "x", kind: "invalid-asset" }, "invalid_request"],
    [{ kind: "not-eligible" }, "forbidden"],
    [{ kind: "not-found" }, "not_found"],
  ] as const)("maps %j to %s", async (outcome, error) => {
    const result = await createImportItemsOperation(async () =>
      stubService({ importItems: vi.fn(async () => outcome) }),
    ).execute(input, context);
    expect(result).toMatchObject({ error, ok: false });
  });

  it("takes only a bounded, strict list of rows", () => {
    const schema = importCollectionItemsInputSchema;
    expect(schema.safeParse(input).success).toBe(true);
    expect(schema.safeParse({ ...input, rows: [] }).success).toBe(false);
    expect(schema.safeParse({ ...input, extra: 1 }).success).toBe(false);
    expect(
      schema.safeParse({ ...input, rows: [{ ...row, imageAssetId: id() }] })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...input,
        rows: [{ ...row, imageFileName: "a/b.png" }],
      }).success,
    ).toBe(false);
  });
});
