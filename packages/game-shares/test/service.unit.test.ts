import { describe, expect, it, vi } from "vitest";

import type { GameShareRepository, NewShare } from "../src/repository.ts";
import { createGameSharesService } from "../src/service.ts";

const now = new Date("2026-11-08T12:00:00.000Z");
const owner = "11111111-1111-4111-8111-111111111111";

function setup(level: "replay-verified" | "self-reported" | null) {
  const stored: NewShare[] = [];
  const repository: GameShareRepository = {
    createOrGet: vi.fn((share: NewShare) => {
      stored.push(share);
      return Promise.resolve(share);
    }),
    get: vi.fn(() => Promise.resolve(null)),
    revoke: vi.fn(() => Promise.resolve(true)),
  };
  const lookup = vi.fn(() => Promise.resolve(level));
  const service = createGameSharesService({
    clock: () => now,
    games: new Map([
      ["arcade", new Map([["first-win", { claimPolicy: "once" }]])],
    ]),
    level: lookup,
    newId: () => "22222222-2222-4222-8222-222222222222",
    repository,
  });
  return { lookup, repository, service, stored };
}

describe("sharing a milestone", () => {
  it("shows the level the account holds, never one the request names", async () => {
    const { service, stored } = setup("self-reported");
    const request = {
      gameId: "arcade",
      kind: "milestone",
      milestoneId: "first-win",
      verification: "replay-verified",
    };
    // The request type has no level; a stray field is only an attempt to ask for a stronger label.
    const outcome = await service.create(owner, request as never);
    expect(outcome.kind).toBe("shared");
    expect(stored[0]?.thing).toMatchObject({ verification: "self-reported" });
  });

  it("carries the verified level when the account has it", async () => {
    const { service, stored } = setup("replay-verified");
    await service.create(owner, {
      gameId: "arcade",
      kind: "milestone",
      milestoneId: "first-win",
    });
    expect(stored[0]?.thing).toMatchObject({ verification: "replay-verified" });
    expect(stored[0]).toMatchObject({ createdAt: now, userId: owner });
  });

  it("refuses a milestone the account does not hold, and writes nothing", async () => {
    const { repository, service } = setup(null);
    expect(
      await service.create(owner, {
        gameId: "arcade",
        kind: "milestone",
        milestoneId: "first-win",
      }),
    ).toEqual({ kind: "not-earned" });
    expect(repository.createOrGet).not.toHaveBeenCalled();
  });

  it("refuses a game that is not listed and a milestone the game does not declare, before asking the account", async () => {
    const { lookup, repository, service } = setup("replay-verified");
    expect(
      await service.create(owner, {
        gameId: "nowhere",
        kind: "milestone",
        milestoneId: "first-win",
      }),
    ).toEqual({ kind: "unknown-game" });
    expect(
      await service.create(owner, {
        gameId: "arcade",
        kind: "milestone",
        milestoneId: "invented",
      }),
    ).toEqual({ kind: "unknown-milestone" });
    expect(lookup).not.toHaveBeenCalled();
    expect(repository.createOrGet).not.toHaveBeenCalled();
  });
});

describe("sharing a score and the case", () => {
  it("calls a score self-reported, whatever the account holds", async () => {
    const { service, stored } = setup("replay-verified");
    await service.create(owner, {
      gameId: "arcade",
      kind: "score",
      score: 4210,
    });
    expect(stored[0]?.thing).toEqual({
      gameId: "arcade",
      kind: "score",
      score: 4210,
      verification: "self-reported",
    });
  });

  it("refuses a score for a game that is not listed", async () => {
    const { repository, service } = setup(null);
    expect(
      await service.create(owner, {
        gameId: "nowhere",
        kind: "score",
        score: 1,
      }),
    ).toEqual({ kind: "unknown-game" });
    expect(repository.createOrGet).not.toHaveBeenCalled();
  });

  it("shares the case with nothing about its owner in what it shows", async () => {
    const { service, stored } = setup(null);
    await service.create(owner, { kind: "milestones" });
    expect(stored[0]?.thing).toEqual({ kind: "milestones" });
  });
});

describe("finding a share for the server", () => {
  it("gives the thing with its owner, and nothing for a share that is not live", async () => {
    const stored = {
      createdAt: now,
      id: "x",
      thing: { kind: "milestones" as const },
      userId: owner,
    };
    const repository: GameShareRepository = {
      createOrGet: vi.fn(),
      get: vi.fn(async (id: string) => (id === "x" ? stored : null)),
      revoke: vi.fn(),
    };
    const service = createGameSharesService({
      clock: () => now,
      games: new Map(),
      level: async () => null,
      newId: () => "y",
      repository,
    });
    expect(await service.find("x")).toEqual({
      owner,
      thing: { kind: "milestones" },
    });
    expect(await service.find("gone")).toBeNull();
  });
});

describe("reading and ending a share", () => {
  it("passes the clock to a revoke and answers with the thing alone", async () => {
    const { repository, service } = setup(null);
    expect(await service.revoke(owner, "x")).toBe(true);
    expect(repository.revoke).toHaveBeenCalledWith(owner, "x", now);
    expect(await service.get("x")).toBeNull();
  });
});
