import type { FetchLike } from "@ador/client-http";
import { describe, expect, it, vi } from "vitest";

import { createMintedApi } from "../src/client/minted-api.ts";

const mint = {
  claimId: "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60",
  gameId: "arcade",
  milestoneId: "first-win",
  mintedAt: "2026-10-17T12:00:00.000Z",
  transactionId: "ab".repeat(32),
};
const answering = (body: object, status = 200) =>
  vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status }));

describe("the minted milestones route as the page reaches it", () => {
  it("asks with a POST of nothing, and gives back the mints", async () => {
    const fetchImpl = answering({ minted: [mint] });
    expect(await createMintedApi(fetchImpl).list()).toEqual({ minted: [mint] });
    const [path, init] = fetchImpl.mock.calls[0] ?? [];
    expect(path).toBe("/api/v1/games/milestones/minted");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body ?? "null")).toEqual({});
  });

  it("refuses an answer that is not the contract's shape, rather than listing it", async () => {
    await expect(
      createMintedApi(answering({ minted: [{ ...mint, extra: 1 }] })).list(),
    ).rejects.toThrow();
  });

  it("throws what the requester throws when the platform refuses", async () => {
    await expect(createMintedApi(answering({}, 500)).list()).rejects.toThrow();
  });

  it("asks for a picture with a POST of the claim, and gives back what the platform says", async () => {
    const ok = {
      contentType: "image/svg+xml",
      data: "PHN2Zz48L3N2Zz4=",
      edition: 2,
      status: "ok",
    };
    const fetchImpl = answering(ok);
    expect(await createMintedApi(fetchImpl).picture(mint.claimId)).toEqual(ok);
    const [path, init] = fetchImpl.mock.calls[0] ?? [];
    expect(path).toBe("/api/v1/games/milestones/picture");
    expect(JSON.parse(init?.body ?? "null")).toEqual({ claimId: mint.claimId });
  });

  it("refuses a picture of a kind the contract does not show", async () => {
    await expect(
      createMintedApi(
        answering({
          contentType: "text/html",
          data: "eA==",
          edition: 1,
          status: "ok",
        }),
      ).picture(mint.claimId),
    ).rejects.toThrow();
  });
});
