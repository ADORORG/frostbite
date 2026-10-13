import type { FetchLike } from "@ador/client-http";
import type { LocalSnapshot } from "@ador/game-sdk/local-backend";
import { describe, expect, it, vi } from "vitest";

import { createAccountPort } from "../src/client/account-sync.ts";

const state: LocalSnapshot = {
  counters: [],
  milestones: [],
  progress: { savedAt: "2026-10-01T00:00:00.000Z", state: { taps: 1 } },
};
const playerId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status });
const denied = (code: string, status: number) =>
  json(
    {
      error: {
        code,
        correlationId: "01890f0e-7c8a-7b3a-8a3e-0123456789ab",
        message: "No.",
      },
    },
    status,
  );

describe("the account port", () => {
  it("posts the game and the state to the sync route and returns the merged state", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({ ...state, playerId }),
    );
    const result = await createAccountPort("tap-tower", fetchImpl).sync(state);
    // The id is handed over apart from the state, which stays what the browser keeps.
    expect(result).toEqual({ kind: "synced", playerId, state });
    const [path, init] = fetchImpl.mock.calls[0] ?? [];
    expect(path).toBe("/api/v1/games/sync");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body ?? "")).toEqual({
      gameId: "tap-tower",
      state,
    });
  });

  it.each([
    ["no player id", { ...state }],
    ["a player id that is not an id", { ...state, playerId: "someone" }],
    ["a field nobody declared", { ...state, playerId, email: "a@b.c" }],
  ])(
    "treats an answer with %s as a failure, never as a state",
    async (_what, body) => {
      const port = createAccountPort("g", async () => json(body));
      expect(await port.sync(state)).toEqual({ kind: "failed" });
    },
  );

  it("reads a 401 as nobody signed in, not as a failure", async () => {
    const port = createAccountPort("g", async () =>
      denied("unauthorized", 401),
    );
    expect(await port.sync(state)).toEqual({ kind: "signed-out" });
  });

  it.each([
    ["a server error", async () => denied("internal_error", 503)],
    ["a rate limit", async () => denied("rate_limited", 429)],
    ["a refused game", async () => denied("not_found", 404)],
    ["a reply that is not the contract", async () => json({ nope: true })],
    [
      "a network failure",
      async (): Promise<Response> => {
        throw new TypeError("offline");
      },
    ],
  ])("reports %s as a failed sync", async (_name, fetchImpl) => {
    expect(await createAccountPort("g", fetchImpl).sync(state)).toEqual({
      kind: "failed",
    });
  });

  it("gives up after the time limit and reports a failed sync", async () => {
    const hang: FetchLike = (_path, init) =>
      new Promise((_resolve, reject) =>
        init.signal?.addEventListener("abort", () =>
          reject(init.signal?.reason),
        ),
      );
    expect(await createAccountPort("g", hang, 20).sync(state)).toEqual({
      kind: "failed",
    });
  });
});
