import {
  authSessions,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
} from "@ador/database";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { withDisposablePostgres } from "../../../packages/database/test/support/postgres-container.ts";
import { applyMigrations } from "@ador/database";
import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { reviveSession } from "../scripts/stack-setup.ts";

const { sessionId, sessionToken, userId } = creatorE2EFixtures.staff;
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

describe("a seeded session after the person signed out", () => {
  it("is usable again once the stack revives it, and no other session is touched", async () => {
    await withDisposablePostgres(async (url) => {
      const pool = createDatabasePool({
        DATABASE_ACQUIRE_TIMEOUT_MS: 5_000,
        DATABASE_IDLE_TIMEOUT_MS: 1_000,
        DATABASE_POOL_MAX: 2,
        DATABASE_SSL_MODE: "disable",
        DATABASE_STATEMENT_TIMEOUT_MS: 5_000,
        DATABASE_URL: url,
      });
      try {
        const database = createDatabaseClient(pool);
        await applyMigrations(database);
        const expiry = new Date("2099-01-01T00:00:00.000Z");
        const revoked = new Date("2026-10-23T12:00:00.000Z");
        const other = "01994b10-0000-7000-8000-0000000000aa";
        await database.insert(authUsers).values([
          {
            email: "a@example.test",
            emailVerified: true,
            id: userId,
            name: "A",
          },
          {
            email: "b@example.test",
            emailVerified: true,
            id: other,
            name: "B",
          },
        ]);
        await database.insert(authSessions).values([
          {
            absoluteExpiresAt: expiry,
            authenticatedAt: revoked,
            id: sessionId,
            idleExpiresAt: revoked,
            revokedAt: revoked,
            tokenHash: hash(sessionToken),
            userId,
          },
          {
            absoluteExpiresAt: expiry,
            authenticatedAt: revoked,
            id: "01994b10-0000-7000-8000-0000000000ab",
            idleExpiresAt: revoked,
            revokedAt: revoked,
            tokenHash: hash("someone-else"),
            userId: other,
          },
        ]);

        const now = new Date("2026-10-23T13:00:00.000Z");
        await reviveSession(database, sessionToken, now);

        const [mine] = await database
          .select()
          .from(authSessions)
          .where(eq(authSessions.id, sessionId));
        expect(mine?.revokedAt).toBeNull();
        expect(mine?.idleExpiresAt.toISOString()).toBe(
          "2026-10-24T13:00:00.000Z",
        );
        const [theirs] = await database
          .select()
          .from(authSessions)
          .where(eq(authSessions.tokenHash, hash("someone-else")));
        expect(theirs?.revokedAt).toEqual(revoked);
      } finally {
        await pool.end();
      }
    });
  });
});
