import type { FetchLike } from "@frostbite/client-http";
import { gameAdminMintRoutes, gameAdminRoutes } from "@frostbite/shared/games";
import { describe, expect, it, vi } from "vitest";

import { createGameAdminApi } from "../src/client/api.ts";
import { step, stepId } from "./support/fake-api.ts";

const json = (body: object) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
const asked = (fetchImpl: ReturnType<typeof vi.fn>) =>
  fetchImpl.mock.calls.map(([path, init]) => [
    path,
    JSON.parse(String((init as { body: string }).body)) as object,
  ]);

describe("the administration routes as the page reaches them", () => {
  it("lists a game's steps, validating what comes back", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({
        contract: { address: "2:7", maxDrawingBytes: 4096 },
        drawingCeiling: 8192,
        steps: [step()],
        templatesReady: true,
      }),
    );
    const result = await createGameAdminApi(fetchImpl).list("arcade");
    expect(result.steps).toHaveLength(1);
    expect(result.contract?.address).toBe("2:7");
    expect(fetchImpl.mock.calls[0]).toEqual([
      `${gameAdminRoutes.list.path}?gameId=arcade`,
      expect.objectContaining({ method: "GET" }),
    ]);
  });

  it("lists the templates, which are published and where, and the steps that publish them", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({
        publishable: [{ id: "game-rewards", version: "1.0.0" }],
        published: [
          {
            address: "4:100",
            publishedAt: "2026-10-16T12:00:00.000Z",
            templateRef: "game-rewards@1.0.0",
          },
        ],
        steps: [step()],
      }),
    );
    const result = await createGameAdminApi(fetchImpl).templates();
    expect(result.published[0]?.address).toBe("4:100");
    expect(fetchImpl.mock.calls[0]).toEqual([
      gameAdminRoutes.templates.path,
      expect.objectContaining({ method: "GET" }),
    ]);
  });

  it("starts a step, sends it signed, and looks at it, each on its own route with its own body", async () => {
    const fetchImpl = vi.fn<FetchLike>(async (path) =>
      json(
        path === gameAdminRoutes.start.path
          ? { resumed: false, status: "started", step: step() }
          : path === gameAdminRoutes.submit.path
            ? { status: "submitted", step: step() }
            : { status: "ok", step: step() },
      ),
    );
    const api = createGameAdminApi(fetchImpl);
    const action = { operation: "set-claims-paused", paused: true } as const;
    await api.start({ action, gameId: "arcade", wallet: "w" });
    const signed = {
      chain: "simnet:one",
      family: "simulated",
      format: "f",
      payload: "p",
    };
    await api.submit({ signed, stepId });
    await api.refresh(stepId);
    expect(asked(fetchImpl)).toEqual([
      [gameAdminRoutes.start.path, { action, gameId: "arcade", wallet: "w" }],
      [gameAdminRoutes.submit.path, { signed, stepId }],
      [gameAdminRoutes.refresh.path, { stepId }],
    ]);
  });

  it("sends the address staff enter for a step, and validates the answer", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({ status: "recorded", step: step({ state: "complete" }) }),
    );
    const answer = await createGameAdminApi(fetchImpl).record({
      address: "2:7",
      stepId,
    });
    expect(answer.status).toBe("recorded");
    expect(asked(fetchImpl)).toEqual([
      [gameAdminRoutes.record.path, { address: "2:7", stepId }],
    ]);
  });

  it("refuses an answer that is not in the documented shape", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({ steps: [{ id: "x" }] }),
    );
    await expect(
      createGameAdminApi(fetchImpl).list("arcade"),
    ).rejects.toThrow();
  });
});

describe("the mint and fee routes as the page reaches them", () => {
  const cursor =
    "2026-10-16T12:00:00.000Z~0198a000-0000-7000-8000-0000000000c1";
  const page = {
    mints: [],
    next: null,
    totals: { completed: 0, feesAccruedUnits: "0", inProgress: 0 },
  };

  it("asks for a game's mints, and for the page after a cursor, as a query", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json(page));
    const api = createGameAdminApi(fetchImpl);
    await api.mints("arcade");
    await api.mints("arcade", cursor);
    expect(fetchImpl.mock.calls.map(([path]) => path)).toEqual([
      `${gameAdminMintRoutes.mints.path}?gameId=arcade`,
      `${gameAdminMintRoutes.mints.path}?${new URLSearchParams({ after: cursor, gameId: "arcade" }).toString()}`,
    ]);
  });

  it("asks for every game's totals and for the platform fee, validating what comes back", async () => {
    const fetchImpl = vi.fn<FetchLike>(async (path) =>
      json(
        String(path).includes("mint-totals") ? { games: [] } : { chains: [] },
      ),
    );
    const api = createGameAdminApi(fetchImpl);
    expect(await api.mintTotals()).toEqual({ games: [] });
    expect(await api.platformFee()).toEqual({ chains: [] });
    await expect(
      createGameAdminApi(async () => json({ chains: "no" })).platformFee(),
    ).rejects.toBeDefined();
  });

  it("sets the fee and its address in one request body", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({ reason: "unknown-chain", status: "refused" }),
    );
    const input = {
      chain: "simnet:one" as never,
      feeUnits: "1500",
      treasury: "sim:one:7ea5a1ab",
    };
    expect(await createGameAdminApi(fetchImpl).setPlatformFee(input)).toEqual({
      reason: "unknown-chain",
      status: "refused",
    });
    expect(asked(fetchImpl)).toEqual([
      [gameAdminMintRoutes.setPlatformFee.path, input],
    ]);
  });
});
