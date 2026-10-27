import { uuidV7Schema } from "@ador/shared/identifiers";
import {
  libraryResponseSchema,
  type LibraryResponse,
} from "@ador/shared/uploads";
import { describe, expect, it, vi } from "vitest";

import {
  createListOlderUploadedAssetsOperation,
  createListUploadedAssetsOperation,
} from "../src/application/library-operation.ts";

const userId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000001");
const context = {
  actorSession: null,
  actorUserId: userId,
  correlationId: userId,
};
const empty: LibraryResponse = { assets: [], nextCursor: null };

describe("list uploaded assets operation", () => {
  it("requires authentication before constructing the service", async () => {
    const getService = vi.fn();
    const operation = createListUploadedAssetsOperation(getService);
    await expect(
      operation.execute({}, { ...context, actorUserId: null }),
    ).resolves.toMatchObject({ error: "unauthorized", ok: false });
    expect(getService).not.toHaveBeenCalled();
  });

  it("lists for the session user, never for a caller-supplied id", async () => {
    const list = vi.fn(async () => empty);
    const operation = createListUploadedAssetsOperation(async () => ({ list }));
    await expect(operation.execute({}, context)).resolves.toEqual({
      ok: true,
      value: empty,
    });
    expect(list).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it("is an authenticated, side-effect-free GET with an empty strict input and a validated output", () => {
    const operation = createListUploadedAssetsOperation(vi.fn());
    expect(operation).toMatchObject({
      access: { kind: "authenticated" },
      idempotency: "none",
      input: "none",
      method: "GET",
      operationId: "listUploadedAssets",
      path: "/api/v1/uploads/assets",
    });
    expect(operation.inputSchema.safeParse({}).success).toBe(true);
    expect(operation.inputSchema.safeParse({ userId }).success).toBe(false);
    expect(operation.outputSchema).toBe(libraryResponseSchema);
  });
});

const cursor = "1760000000000.0198a000-0000-7000-8000-000000000001";

describe("list older uploaded assets operation", () => {
  it("requires authentication before constructing the service", async () => {
    const getService = vi.fn();
    const operation = createListOlderUploadedAssetsOperation(getService);
    await expect(
      operation.execute({ before: cursor }, { ...context, actorUserId: null }),
    ).resolves.toMatchObject({ error: "unauthorized", ok: false });
    expect(getService).not.toHaveBeenCalled();
  });

  it("lists the page after the cursor for the session user, never for a caller-supplied id", async () => {
    const list = vi.fn(async () => empty);
    const operation = createListOlderUploadedAssetsOperation(async () => ({
      list,
    }));
    await expect(
      operation.execute({ before: cursor }, context),
    ).resolves.toEqual({ ok: true, value: empty });
    expect(list).toHaveBeenCalledExactlyOnceWith(userId, cursor);
  });

  it("is an authenticated, revalidated GET whose input is a cursor and nothing else, and whose output is the library's", () => {
    const operation = createListOlderUploadedAssetsOperation(vi.fn());
    expect(operation).toMatchObject({
      access: { kind: "authenticated" },
      idempotency: "none",
      cache: { kind: "revalidate" },
      input: "query",
      method: "GET",
      operationId: "listOlderUploadedAssets",
      path: "/api/v1/uploads/assets/older",
    });
    expect(operation.inputSchema.safeParse({ before: cursor }).success).toBe(
      true,
    );
    for (const bad of [{}, { before: "yesterday" }, { before: cursor, userId }])
      expect(operation.inputSchema.safeParse(bad).success).toBe(false);
    expect(operation.outputSchema).toBe(libraryResponseSchema);
  });
});
