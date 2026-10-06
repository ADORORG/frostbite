import { uuidV7Schema } from "@ador/shared/identifiers";
import {
  libraryResponseSchema,
  type LibraryResponse,
} from "@ador/shared/uploads";
import { describe, expect, it, vi } from "vitest";

import { createListUploadedAssetsOperation } from "../src/application/library-operation.ts";

const userId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000001");
const context = {
  actorSession: null,
  actorUserId: userId,
  correlationId: userId,
};
const empty: LibraryResponse = { assets: [], truncated: false };

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
