import type { FetchLike } from "@frostbite/client-http";
import { describe, expect, it, vi } from "vitest";

import { createRunsService } from "../src/client/runs-port.ts";

const runId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
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
const started = {
  expiresAt: "2026-10-16T12:00:00.000Z",
  runId,
  seed: 4_000_000_000,
  status: "started",
} as const;

describe("starting a run from the page", () => {
  it("posts the game to the start route and returns the run", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json(started));
    expect(await createRunsService("tap-tower", fetchImpl).start()).toEqual(
      started,
    );
    const [path, init] = fetchImpl.mock.calls[0] ?? [];
    expect(path).toBe("/api/v1/games/runs/start");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body ?? "")).toEqual({ gameId: "tap-tower" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("passes on why a run is unavailable", async () => {
    const answer = { reason: "too-many-open-runs", status: "unavailable" };
    const service = createRunsService("g", async () => json(answer));
    expect(await service.start()).toEqual(answer);
  });

  it("answers signed-out, not an error, when nobody is signed in", async () => {
    const service = createRunsService("g", async () =>
      denied("unauthorized", 401),
    );
    expect(await service.start()).toEqual({
      reason: "signed-out",
      status: "unavailable",
    });
  });

  it("throws for any other failure, and for an answer that is not the contract", async () => {
    for (const fetchImpl of [
      async () => denied("internal_error", 500),
      async () => json({ status: "started" }),
      async () => {
        throw new TypeError("offline");
      },
    ] as FetchLike[])
      await expect(createRunsService("g", fetchImpl).start()).rejects.toThrow();
  });
});

describe("submitting a run from the page", () => {
  it("posts the game, the run and the record, and returns the verdict as the platform gave it", async () => {
    const verdict = { earned: ["first-win"], status: "verified" };
    const fetchImpl = vi.fn<FetchLike>(async () => json(verdict));
    const record = { inputs: [1], seed: 5 };
    expect(
      await createRunsService("tap-tower", fetchImpl).submit(runId, record),
    ).toEqual(verdict);
    const [path, init] = fetchImpl.mock.calls[0] ?? [];
    expect(path).toBe("/api/v1/games/runs/submit");
    expect(JSON.parse(init?.body ?? "")).toEqual({
      gameId: "tap-tower",
      record,
      runId,
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns a rejection and a refusal as they are", async () => {
    for (const answer of [
      { reason: "illegal-input", status: "rejected" },
      { reason: "expired", status: "refused" },
    ])
      expect(
        await createRunsService("g", async () => json(answer)).submit(
          runId,
          {},
        ),
      ).toEqual(answer);
  });

  it("throws when nobody is signed in or the platform fails, so the game is told the platform is unavailable", async () => {
    for (const fetchImpl of [
      async () => denied("unauthorized", 401),
      async () => denied("internal_error", 500),
    ] as FetchLike[])
      await expect(
        createRunsService("g", fetchImpl).submit(runId, {}),
      ).rejects.toThrow();
  });
});
