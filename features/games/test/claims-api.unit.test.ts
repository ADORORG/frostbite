import type { FetchLike } from "@ador/client-http";
import { describe, expect, it, vi } from "vitest";

import { createClaimsApi } from "../src/client/claims-api.ts";

const claimId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status });
const wire = {
  failureReason: null,
  gameId: "arcade",
  id: claimId,
  milestoneId: "first-win",
  state: "pending",
  summary: {
    chain: "simnet:one",
    contractId: "rewards-1",
    expiresAt: "2026-10-16T12:10:00.000Z",
    fee: { asset: "sim", baseUnits: "1" },
    milestoneId: "first-win",
    recipient: "sim:one:a1b2c3fe",
  },
  toSign: null,
  transactionId: "abc",
};
const transaction = {
  chain: "simnet:one",
  family: "simulated",
  format: "sim-json/1",
  payload: "{}.sig",
};

function api(answer: object) {
  const fetchImpl = vi.fn<FetchLike>(async () => json(answer));
  return { api: createClaimsApi(fetchImpl), fetchImpl };
}
const call = (fetchImpl: ReturnType<typeof vi.fn<FetchLike>>) => {
  const [path, init] = fetchImpl.mock.calls[0] ?? [];
  return { body: JSON.parse(init?.body ?? "null"), init, path };
};

describe("the claim routes as the page reaches them", () => {
  it("lists a game's claims with a POST of the game", async () => {
    const { api: claims, fetchImpl } = api({ claims: [wire] });
    expect((await claims.list("arcade")).claims).toHaveLength(1);
    const sent = call(fetchImpl);
    expect(sent.path).toBe("/api/v1/games/claims/list");
    expect(sent.init?.method).toBe("POST");
    expect(sent.body).toEqual({ gameId: "arcade" });
    expect(sent.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("looks at one claim", async () => {
    const { api: claims, fetchImpl } = api({ claim: wire, status: "ok" });
    expect(await claims.refresh(claimId)).toMatchObject({ status: "ok" });
    expect(call(fetchImpl)).toMatchObject({
      body: { claimId },
      path: "/api/v1/games/claims/refresh",
    });
  });

  it("starts a claim with the game, the milestone and the wallet's address", async () => {
    const { api: claims, fetchImpl } = api({
      reason: "no-wallet",
      status: "unavailable",
    });
    const input = {
      gameId: "arcade",
      milestoneId: "first-win",
      wallet: "sim:one:a1b2c3fe",
    };
    expect(await claims.start(input)).toEqual({
      reason: "no-wallet",
      status: "unavailable",
    });
    expect(call(fetchImpl)).toMatchObject({
      body: input,
      path: "/api/v1/games/claims/start",
    });
  });

  it("submits what the wallet signed", async () => {
    const { api: claims, fetchImpl } = api({
      claim: wire,
      status: "submitted",
    });
    expect(await claims.submit({ claimId, signed: transaction })).toMatchObject(
      { status: "submitted" },
    );
    expect(call(fetchImpl)).toMatchObject({
      body: { claimId, signed: transaction },
      path: "/api/v1/games/claims/submit",
    });
  });

  it("refuses an answer that is not in the contract's shape", async () => {
    const { api: claims } = api({ claims: [{ ...wire, state: "minted" }] });
    await expect(claims.list("arcade")).rejects.toThrow();
  });
});
