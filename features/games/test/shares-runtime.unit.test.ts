import { describe, expect, it } from "vitest";

import {
  createGameSharesResolver,
  sharesResolverFor,
} from "../src/shares-runtime.ts";
import { embeddedGame, templateGame } from "./support/template-game.ts";

// A database that is never reached: every request below is refused before storage is asked.
const environment = {
  DATABASE_ACQUIRE_TIMEOUT_MS: "1000",
  DATABASE_IDLE_TIMEOUT_MS: "1000",
  DATABASE_POOL_MAX: "1",
  DATABASE_SSL_MODE: "disable",
  DATABASE_STATEMENT_TIMEOUT_MS: "1000",
  DATABASE_URL: "postgresql://nobody:nothing@127.0.0.1:1/none",
} as const;

describe("the games' sharing service", () => {
  it("knows the listed games and the milestones each declares", async () => {
    const service = await createGameSharesResolver(
      [embeddedGame],
      environment,
    )();
    expect(
      await service.create("u1", {
        gameId: "not-listed",
        kind: "score",
        score: 1,
      }),
    ).toEqual({ kind: "unknown-game" });
    expect(
      await service.create("u1", {
        gameId: embeddedGame.id,
        kind: "milestone",
        milestoneId: "never-declared",
      }),
    ).toEqual({ kind: "unknown-milestone" });
  });

  it("is one resolver for one list of games, so the page and the picture share a pool", () => {
    const games = [templateGame];
    expect(sharesResolverFor(games)).toBe(sharesResolverFor(games));
    expect(sharesResolverFor(games)).not.toBe(
      sharesResolverFor([templateGame]),
    );
  });
});
