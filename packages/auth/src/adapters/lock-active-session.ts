import type { DatabaseTransaction } from "@frostbite/database/connection";
import { authSessions } from "@frostbite/database/schema/auth";
import { and, eq, isNull, sql } from "drizzle-orm";

// Locks the session a sensitive change is made from, and says whether it may still make it: it is the user's, not
// revoked, not expired, and was authenticated no longer ago than the recent-authentication window (and not in the
// future). Everything that links or unlinks a sign-in method asks this first, inside its transaction.
export async function lockActiveSession(
  transaction: DatabaseTransaction,
  input: {
    readonly minimumAuthenticatedAt: Date;
    readonly now: Date;
    readonly sessionId: string;
    readonly userId: string;
  },
): Promise<boolean> {
  const [session] = await transaction
    .select({ id: authSessions.id })
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, input.sessionId),
        eq(authSessions.userId, input.userId),
        isNull(authSessions.revokedAt),
        sql`${authSessions.idleExpiresAt} > ${input.now}`,
        sql`${authSessions.absoluteExpiresAt} > ${input.now}`,
        sql`${authSessions.authenticatedAt} >= ${input.minimumAuthenticatedAt}`,
        sql`${authSessions.authenticatedAt} <= ${input.now}`,
      ),
    )
    .for("update")
    .limit(1);
  return session !== undefined;
}
