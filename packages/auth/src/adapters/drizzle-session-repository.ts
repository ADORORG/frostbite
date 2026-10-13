import type { DatabaseClient } from "@ador/database/connection";
import { authSessions } from "@ador/database/schema/auth";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import type { SessionRepository } from "../application/session-repository.ts";

export function createDrizzleSessionRepository(
  database: DatabaseClient,
): SessionRepository {
  return {
    async findAndRenew({ idleLifetimeMs, now, tokenHash }) {
      const requestedIdleExpiry = new Date(now.getTime() + idleLifetimeMs);
      const [session] = await database
        .update(authSessions)
        .set({
          idleExpiresAt: sql`least(${authSessions.absoluteExpiresAt}, ${requestedIdleExpiry})`,
          updatedAt: now,
        })
        .where(
          and(
            eq(authSessions.tokenHash, tokenHash),
            isNull(authSessions.revokedAt),
            gt(authSessions.idleExpiresAt, now),
            gt(authSessions.absoluteExpiresAt, now),
          ),
        )
        .returning();
      if (session === undefined) return null;
      return {
        absoluteExpiresAt: session.absoluteExpiresAt,
        authenticatedAt: session.authenticatedAt,
        idleExpiresAt: session.idleExpiresAt,
        sessionId: uuidV7Schema.parse(session.id),
        userId: uuidV7Schema.parse(session.userId),
      };
    },
    async revoke(tokenHash, revokedAt) {
      const rows = await database
        .update(authSessions)
        .set({ revokedAt, updatedAt: revokedAt })
        .where(
          and(
            eq(authSessions.tokenHash, tokenHash),
            isNull(authSessions.revokedAt),
          ),
        )
        .returning({ id: authSessions.id });
      return rows.length === 1;
    },
    async revokeById(sessionId, userId, revokedAt) {
      const rows = await database
        .update(authSessions)
        .set({ revokedAt, updatedAt: revokedAt })
        .where(
          and(
            eq(authSessions.id, sessionId),
            eq(authSessions.userId, userId),
            isNull(authSessions.revokedAt),
          ),
        )
        .returning({ id: authSessions.id });
      return rows.length === 1;
    },
  };
}
