import { describe, expect, it } from "vitest";

import { createGameSyncResolver } from "../src/runtime.ts";
import { embeddedGame } from "./support/template-game.ts";

// A database that is never reached: every request below is refused before storage is asked.
const environment = {
  DATABASE_ACQUIRE_TIMEOUT_MS: "1000",
  DATABASE_IDLE_TIMEOUT_MS: "1000",
  DATABASE_POOL_MAX: "1",
  DATABASE_SSL_MODE: "disable",
  DATABASE_STATEMENT_TIMEOUT_MS: "1000",
  DATABASE_URL: "postgresql://nobody:nothing@127.0.0.1:1/none",
} as const;
const empty = { milestones: [], progress: null };

describe("the games' account service", () => {
  it("knows the listed games and the milestones each declares, and holds saves to the host policy's limit", async () => {
    const service = await createGameSyncResolver([embeddedGame], environment)();
    expect(
      await service.sync("u1", { gameId: "not-listed", state: empty }),
    ).toEqual({ kind: "unknown-game" });
    expect(
      await service.sync("u1", {
        gameId: embeddedGame.id,
        state: {
          milestones: [
            {
              id: "never-declared",
              unlockedAt: "2026-10-01T00:00:00.000Z",
              verification: "self-reported",
            },
          ],
          progress: null,
        },
      }),
    ).toEqual({ id: "never-declared", kind: "unknown-milestone" });
    expect(
      await service.sync("u1", {
        gameId: embeddedGame.id,
        state: {
          milestones: [],
          progress: {
            savedAt: "2026-10-01T00:00:00.000Z",
            state: "x".repeat(70_000),
          },
        },
      }),
    ).toEqual({ kind: "too-large" });
  });

  it("makes the service once, and refuses to start on a bad database setting", async () => {
    const resolve = createGameSyncResolver([embeddedGame], environment);
    expect(await resolve()).toBe(await resolve());
    await expect(
      createGameSyncResolver([embeddedGame], { DATABASE_URL: "nope" })(),
    ).rejects.toThrow();
  });
});
