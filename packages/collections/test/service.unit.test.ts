import { chainOptionSchema, chainRefSchema } from "@ador/shared/chain";
import type { CollectionDraft } from "@ador/shared/collections";
import { collectionLimits } from "@ador/shared/collections";
import { describe, expect, it } from "vitest";

import { createCollectionService } from "../src/application/service.ts";
import { createRecordingRepository } from "./support/memory-repository.ts";
import { draft, itemFor, newId, signet } from "./support/fixtures.ts";

const fixedNow = new Date("2026-10-09T12:00:00.000Z");
const owner = newId();
const request = { idempotencyKey: "request-key-00000001", ownerUserId: owner };

const disabledChain = chainRefSchema.parse("eip155:1");
const unconfiguredChain = chainRefSchema.parse(
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
);

const options = [
  chainOptionSchema.parse({
    chainId: signet,
    displayName: "Signet",
    enabled: true,
    family: "bitcoin-alkanes",
    role: "public-beta",
  }),
  chainOptionSchema.parse({
    chainId: disabledChain,
    displayName: "Disabled",
    enabled: false,
    family: "evm",
    role: "production",
  }),
];

function setup(results: Parameters<typeof createRecordingRepository>[0] = {}) {
  const { calls, repository } = createRecordingRepository(results);
  const ids = [newId(), newId(), newId()];
  const service = createCollectionService({
    clock: () => fixedNow,
    createId: () => {
      const next = ids.shift();
      if (next === undefined) throw new Error("ran out of ids");
      return next;
    },
    listLimit: 25,
    repository,
    targetChains: options,
  });
  return { calls, ids, service };
}

describe("creating a draft", () => {
  it("passes the validated draft, a fresh id, the clock, and a fingerprint to the repository", async () => {
    const { calls, ids, service } = setup();
    const first = ids[0];
    await service.create({ draft: draft({ name: "  Padded  " }), ...request });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toMatchObject({
      changedAt: fixedNow,
      collectionId: first,
      draft: { name: "Padded" },
      idempotencyKey: request.idempotencyKey,
      ownerUserId: owner,
    });
    expect(calls[0]?.input).toHaveProperty(
      "requestFingerprint",
      expect.stringMatching(/^[0-9a-f]{64}$/u),
    );
  });

  it("fingerprints the content, not the key order of the object", async () => {
    const { calls, service } = setup();
    const original = draft();
    const reordered: CollectionDraft = {
      targetChain: original.targetChain,
      provenance: original.provenance,
      plannedSupply: original.plannedSupply,
      name: original.name,
      description: original.description,
      coverAssetId: original.coverAssetId,
      bannerAssetId: original.bannerAssetId,
    };
    await service.create({ draft: original, ...request });
    await service.create({ draft: reordered, ...request });
    await service.create({ draft: draft({ plannedSupply: 6 }), ...request });
    const [one, two, three] = calls.map(({ input }) =>
      "requestFingerprint" in input ? input.requestFingerprint : null,
    );
    expect(one).toBe(two);
    expect(three).not.toBe(one);
  });

  it("refuses a chain that is not enabled or not configured, without touching storage", async () => {
    const { calls, service } = setup();
    for (const targetChain of [disabledChain, unconfiguredChain]) {
      expect(
        await service.create({ draft: draft({ targetChain }), ...request }),
      ).toEqual({ kind: "invalid-chain" });
    }
    expect(calls).toHaveLength(0);
  });

  it("rejects an invalid draft or idempotency key before persistence", async () => {
    const { calls, service } = setup();
    await expect(
      service.create({ draft: draft({ name: "   " }), ...request }),
    ).rejects.toThrow();
    await expect(
      service.create({ draft: draft(), ...request, idempotencyKey: "short" }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("saving a draft", () => {
  it("refuses a disabled chain and otherwise passes the expected revision through", async () => {
    const { calls, service } = setup();
    const base = {
      collectionId: newId(),
      expectedRevision: 3,
      ownerUserId: owner,
    };
    expect(
      await service.save({
        ...base,
        draft: draft({ targetChain: disabledChain }),
      }),
    ).toEqual({ kind: "invalid-chain" });
    await service.save({ ...base, draft: draft({ name: " Kept " }) });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toMatchObject({
      changedAt: fixedNow,
      draft: { name: "Kept" },
      expectedRevision: 3,
    });
  });
});

describe("items", () => {
  it("adds with the item limit from policy and a fingerprint that includes the collection", async () => {
    const { calls, service } = setup();
    const image = newId();
    const collectionA = newId();
    await service.addItem({
      collectionId: collectionA,
      item: itemFor(image),
      ...request,
    });
    await service.addItem({
      collectionId: newId(),
      item: itemFor(image),
      ...request,
    });
    expect(calls[0]?.input).toMatchObject({
      collectionId: collectionA,
      itemLimit: collectionLimits.itemsPerCollection,
    });
    const fingerprints = calls.map(({ input }) =>
      "requestFingerprint" in input ? input.requestFingerprint : null,
    );
    expect(fingerprints[0]).not.toBe(fingerprints[1]);
  });

  it("validates items, including duplicate traits, before persistence", async () => {
    const { calls, service } = setup();
    const duplicated = itemFor(newId(), {
      attributes: [
        { trait: "Colour", value: "Blue" },
        { trait: "Colour", value: "Red" },
      ],
    });
    await expect(
      service.addItem({ collectionId: newId(), item: duplicated, ...request }),
    ).rejects.toThrow();
    await expect(
      service.updateItem({
        collectionId: newId(),
        item: duplicated,
        itemId: newId(),
        ownerUserId: owner,
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it("updates, removes, finds, and lists through the repository with the clock and limit", async () => {
    const { calls, service } = setup();
    const collectionId = newId();
    const itemId = newId();
    await service.updateItem({
      collectionId,
      item: itemFor(newId()),
      itemId,
      ownerUserId: owner,
    });
    await service.removeItem({ collectionId, itemId, ownerUserId: owner });
    await service.find({ collectionId, ownerUserId: owner });
    await service.list(owner);
    expect(calls.map(({ method }) => method)).toEqual([
      "updateItem",
      "removeItem",
      "find",
      "listForOwner",
    ]);
    expect(calls[0]?.input).toMatchObject({ changedAt: fixedNow });
    expect(calls[1]?.input).toMatchObject({ changedAt: fixedNow });
    expect(calls[3]?.input).toMatchObject({ limit: 25, ownerUserId: owner });
  });
});
