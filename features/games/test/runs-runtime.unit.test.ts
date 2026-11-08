import { createVerifierRegistry } from "@frostbite/game-verification/registry";
import type { GameManifest } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import { createGameRunsResolver, gameRunLookup } from "../src/runs-runtime.ts";
import { embeddedGame } from "./support/template-game.ts";

const sha256 = "a".repeat(64);
const verifiable: GameManifest = {
  ...embeddedGame,
  capabilities: ["run:submit"],
  id: "verifiable-game",
  milestones: [
    ...embeddedGame.milestones,
    {
      claimPolicy: "once",
      criteria: "Win.",
      description: "Won.",
      id: "first-win",
      title: "First win",
      verification: "replay-verified",
    },
  ],
  verification: { replay: { id: "rules", sha256, version: 1 } },
};
const registryFor = (...gameIds: string[]) =>
  createVerifierRegistry(
    gameIds.map((gameId) => ({
      gameId,
      sample: {
        claims: [],
        config: {},
        gameId,
        inputs: [],
        schemaVersion: 1,
        seed: 0,
        verifier: "rules",
        verifierVersion: 1,
      },
      verifier: {
        id: "rules",
        replay: () => ({ earned: [], ok: true, score: null }),
        version: 1,
      },
    })),
  );

describe("what the runs service may know of a game", () => {
  it("is the manifest's pinned digest and only the milestones it declared replay-verifiable", () => {
    const lookup = gameRunLookup([verifiable], registryFor(verifiable.id));
    const known = lookup(verifiable.id);
    expect(known?.verifierSha256).toBe(sha256);
    expect([...(known?.verifiable ?? [])]).toEqual(["first-win"]);
  });

  it("is nothing for a game the platform did not list, one that declares no verifier, and one whose verifier it did not load", () => {
    const lookup = gameRunLookup(
      [verifiable, embeddedGame, { ...verifiable, id: "unloaded-game" }],
      registryFor(verifiable.id, embeddedGame.id),
    );
    expect(lookup("not-listed")).toBeNull();
    expect(lookup(embeddedGame.id)).toBeNull();
    expect(lookup("unloaded-game")).toBeNull();
  });
});

describe("the runs service resolver", () => {
  it("builds a service that has nothing to start for a game with no loaded verifier, without reaching the database", async () => {
    const service = await createGameRunsResolver(
      [embeddedGame],
      { playRoot: "/nonexistent/play" },
      {
        DATABASE_ACQUIRE_TIMEOUT_MS: "1000",
        DATABASE_IDLE_TIMEOUT_MS: "1000",
        DATABASE_POOL_MAX: "1",
        DATABASE_SSL_MODE: "disable",
        DATABASE_STATEMENT_TIMEOUT_MS: "1000",
        DATABASE_URL: "postgresql://nobody:nothing@127.0.0.1:1/none",
      },
    )();
    expect(await service.start("u1", embeddedGame.id)).toEqual({
      code: "unavailable",
      ok: false,
    });
  });
});
