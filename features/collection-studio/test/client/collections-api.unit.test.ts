import { describe, expect, it, vi } from "vitest";

import {
  createCollectionsApi,
  type FetchLike,
} from "../../src/client/collections-api.ts";
import { detail, imageAsset, itemRecord } from "../support/detail.ts";
import { id } from "../support/stubs.ts";

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

function apiWith(respond: FetchLike) {
  const fetchImpl = vi.fn(respond);
  return { api: createCollectionsApi(fetchImpl), fetchImpl };
}

const draft = {
  bannerAssetId: null,
  coverAssetId: null,
  description: "",
  name: "First light",
  plannedSupply: 5,
  provenance: "",
  targetChain: "bip122:00000008819873e925422c1ff0f99f7c",
};
const item = {
  attributes: [],
  description: "",
  imageAssetId: id(),
  name: "Item",
};
const key = "request-key-00000001";

describe("collections API client", () => {
  it("creates a draft with the idempotency key and returns the validated detail", async () => {
    const created = detail();
    const { api, fetchImpl } = apiWith(async () => json(created));
    await expect(api.create(draft, { idempotencyKey: key })).resolves.toEqual(
      created,
    );
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/collection-drafts", {
      body: JSON.stringify(draft),
      headers: { "content-type": "application/json", "idempotency-key": key },
      method: "POST",
    });
  });

  it("lists drafts without a body", async () => {
    const { api, fetchImpl } = apiWith(async () => json({ collections: [] }));
    await expect(api.list()).resolves.toEqual({ collections: [] });
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/collection-drafts", {
      headers: {},
      method: "GET",
    });
  });

  it("reads a draft by id, named in the query string, because the API has no path parameters", async () => {
    const read = detail();
    const { api, fetchImpl } = apiWith(async () => json(read));
    await expect(api.read(read.collection.id)).resolves.toEqual(read);
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/collection-drafts/read?collectionId=${read.collection.id}`,
      { headers: {}, method: "GET" },
    );
  });

  it("saves with the revision it was based on", async () => {
    const saved = detail({ revision: 3 });
    const { api, fetchImpl } = apiWith(async () => json(saved));
    const input = {
      collectionId: saved.collection.id,
      draft,
      expectedRevision: 2,
    };
    await expect(api.save(input)).resolves.toEqual(saved);
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/collection-drafts", {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
  });

  it("adds, updates, and removes items, returning the new revision each time", async () => {
    const record = itemRecord(1);
    const { api, fetchImpl } = apiWith(async (_path, init) =>
      init.method === "DELETE"
        ? json({ removed: true, revision: 5 })
        : json({ item: record, revision: 4 }),
    );
    const collectionId = id();
    await expect(
      api.addItem({ collectionId, item }, { idempotencyKey: key }),
    ).resolves.toEqual({ item: record, revision: 4 });
    await expect(
      api.updateItem({ collectionId, item, itemId: record.id }),
    ).resolves.toEqual({ item: record, revision: 4 });
    await expect(
      api.removeItem({ collectionId, itemId: record.id }),
    ).resolves.toEqual({ removed: true, revision: 5 });
    expect(
      fetchImpl.mock.calls.map(([path, init]) => `${init.method} ${path}`),
    ).toEqual([
      "POST /api/v1/collection-drafts/items",
      "PUT /api/v1/collection-drafts/items",
      "DELETE /api/v1/collection-drafts/items",
    ]);
    expect(fetchImpl.mock.calls[0]?.[1].headers).toMatchObject({
      "idempotency-key": key,
    });
  });

  it("lists the creator's uploads through the uploads contract", async () => {
    const asset = imageAsset("collection-artwork");
    const { api, fetchImpl } = apiWith(async () =>
      json({ assets: [asset], nextCursor: null }),
    );
    await expect(api.listImages()).resolves.toEqual({
      assets: [asset],
      nextCursor: null,
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/uploads/assets", {
      headers: {},
      method: "GET",
    });
  });

  it("rejects a response that does not match the contract, and passes the abort signal on", async () => {
    const { api, fetchImpl } = apiWith(async () =>
      json({ collections: [{ id: "x" }] }),
    );
    const { signal } = new AbortController();
    await expect(api.list({ signal })).rejects.toMatchObject({
      code: "invalid-response",
    });
    expect(fetchImpl.mock.calls[0]?.[1].signal).toBe(signal);
  });

  it("surfaces the server's error code", async () => {
    const correlationId = "018f22f2-9c1a-7b21-8c45-0000000000aa";
    const { api } = apiWith(async () =>
      json(
        { error: { code: "conflict", correlationId, message: "Changed." } },
        409,
      ),
    );
    await expect(
      api.save({ collectionId: id(), draft, expectedRevision: 1 }),
    ).rejects.toMatchObject({
      code: "conflict",
      status: 409,
    });
  });

  describe("creator standing", () => {
    const correlationId = "018f22f2-9c1a-7b21-8c45-0000000000aa";
    const application = (state: string) => ({
      application: {
        applicantUserId: id(),
        draft: {
          contentDeclarationAccepted: true,
          displayName: "A",
          expectedLaunchSize: "10",
          expectedLaunchTiming: "soon",
          jurisdictionAcknowledged: true,
          portfolioLinks: [],
          projectSummary: "x",
          provenanceDeclarationAccepted: true,
          rightsDeclarationAccepted: true,
        },
        feedback: null,
        id: id(),
        revision: 1,
        state,
      },
    });

    it("reads the state of the caller's own application", async () => {
      const { api, fetchImpl } = apiWith(async () =>
        json(application("approved")),
      );
      await expect(api.creatorStanding()).resolves.toEqual({
        state: "approved",
      });
      expect(fetchImpl).toHaveBeenCalledWith(
        "/api/v1/creator-application",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("answers that a person who never applied has no state, rather than failing", async () => {
      const { api } = apiWith(async () =>
        json(
          { error: { code: "not_found", correlationId, message: "None." } },
          404,
        ),
      );
      await expect(api.creatorStanding()).resolves.toEqual({ state: null });
    });

    it("still fails for anything else, so an outage is not read as never having applied", async () => {
      const { api } = apiWith(async () =>
        json(
          { error: { code: "internal_error", correlationId, message: "x" } },
          500,
        ),
      );
      await expect(api.creatorStanding()).rejects.toMatchObject({
        code: "internal_error",
      });
      const network = apiWith(async () => {
        throw new TypeError("offline");
      });
      await expect(network.api.creatorStanding()).rejects.toMatchObject({
        code: "network",
      });
    });
  });
});
