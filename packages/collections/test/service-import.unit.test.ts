import { chainOptionSchema } from "@frostbite/shared/chain";
import { collectionLimits } from "@frostbite/shared/collections";
import { describe, expect, it } from "vitest";

import { createCollectionService } from "../src/application/service.ts";
import { newId, rowFor, signet } from "./support/fixtures.ts";
import { createRecordingRepository } from "./support/memory-repository.ts";

const fixedNow = new Date("2026-10-09T12:00:00.000Z");
const request = {
  collectionId: newId(),
  dryRun: false,
  idempotencyKey: "request-key-00000001",
  ownerUserId: newId(),
};

function setup() {
  const { calls, repository } = createRecordingRepository();
  const service = createCollectionService({
    clock: () => fixedNow,
    createId: newId,
    listLimit: 25,
    repository,
    targetChains: [
      chainOptionSchema.parse({
        chainId: signet,
        displayName: "Signet",
        enabled: true,
        family: "bitcoin-alkanes",
        role: "public-beta",
      }),
    ],
  });
  return { calls, service };
}

describe("importing items", () => {
  it("hands the checked rows to the repository, each with its own new identifier", async () => {
    const { calls, service } = setup();
    await service.importItems({
      ...request,
      rows: [rowFor("a.png", { name: "  Padded  " }), rowFor("b.png")],
    });
    const input = calls[0]?.input as {
      changedAt: Date;
      dryRun: boolean;
      itemLimit: number;
      rows: { itemId: string; row: { name: string } }[];
    };
    expect(calls[0]?.method).toBe("importItems");
    expect(input).toMatchObject({
      changedAt: fixedNow,
      dryRun: false,
      itemLimit: collectionLimits.itemsPerCollection,
    });
    expect(input.rows.map(({ row }) => row.name)).toEqual([
      "Padded",
      "Item for b.png",
    ]);
    expect(new Set(input.rows.map(({ itemId }) => itemId)).size).toBe(2);
  });

  it("fingerprints the content and not whether it was a dry run, so a check and the import agree", async () => {
    const { calls, service } = setup();
    const rows = [rowFor("a.png")];
    await service.importItems({ ...request, dryRun: true, rows });
    await service.importItems({ ...request, rows });
    await service.importItems({ ...request, rows: [rowFor("b.png")] });
    const prints = calls.map(
      ({ input }) =>
        (input as { requestFingerprint: string }).requestFingerprint,
    );
    expect(prints[0]).toBe(prints[1]);
    expect(prints[2]).not.toBe(prints[0]);
    expect(prints[0]).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("refuses rows the schema refuses, before asking persistence anything", async () => {
    const { calls, service } = setup();
    await expect(
      service.importItems({ ...request, rows: [] }),
    ).rejects.toThrow();
    await expect(
      service.importItems({
        ...request,
        rows: [rowFor("a.png", { name: "" })],
      }),
    ).rejects.toThrow();
    await expect(
      service.importItems({
        ...request,
        rows: Array.from({ length: collectionLimits.importRows + 1 }, () =>
          rowFor("a.png"),
        ),
      }),
    ).rejects.toThrow();
    await expect(
      service.importItems({
        ...request,
        idempotencyKey: "short",
        rows: [rowFor("a.png")],
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});
