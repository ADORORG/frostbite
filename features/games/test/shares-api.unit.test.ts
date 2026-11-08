import type { FetchLike } from "@frostbite/client-http";
import { describe, expect, it, vi } from "vitest";

import { createSharesApi } from "../src/client/shares-api.ts";

const answering = (body: object, status = 200) =>
  vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status }));
const id = "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a";

describe("the share route as the page reaches it", () => {
  it("asks with a POST of what to share, and gives back the link's path", async () => {
    const fetchImpl = answering({ id, path: `/s/${id}`, status: "shared" });
    const answer = await createSharesApi(fetchImpl).create({
      gameId: "arcade",
      kind: "score",
      score: 12,
    });
    expect(answer).toEqual({ id, path: `/s/${id}`, status: "shared" });
    const [path, init] = fetchImpl.mock.calls[0] ?? [];
    expect(path).toBe("/api/v1/games/shares");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      gameId: "arcade",
      kind: "score",
      score: 12,
    });
  });

  it("passes a refusal on as a value, not an error", async () => {
    const answer = await createSharesApi(
      answering({ reason: "not-earned", status: "unavailable" }),
    ).create({ kind: "milestones" });
    expect(answer).toEqual({ reason: "not-earned", status: "unavailable" });
  });

  it("refuses an answer that is not the contract's shape, and throws what the requester throws", async () => {
    await expect(
      createSharesApi(answering({ status: "shared", path: "/s/x" })).create({
        kind: "milestones",
      }),
    ).rejects.toThrow();
    await expect(
      createSharesApi(answering({}, 500)).create({ kind: "milestones" }),
    ).rejects.toThrow();
  });
});
