import { createHash } from "node:crypto";

import type { Page } from "@playwright/test";
import {
  authSessions,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@ador/database";
import { eq } from "drizzle-orm";

import { creatorE2EFixtures } from "../../src/creator-fixtures.ts";
import { useE2ESession } from "../../src/session.ts";

// Changing roles needs a recent sign-in, and the seeded session was made when the run began, which may be a while ago: sign in again.
async function signInAgain(token: string) {
  const pool = createDatabasePool(parseDatabaseEnvironment(process.env));
  try {
    await createDatabaseClient(pool)
      .update(authSessions)
      .set({ authenticatedAt: new Date(), revokedAt: null })
      .where(
        eq(
          authSessions.tokenHash,
          createHash("sha256").update(token).digest("hex"),
        ),
      );
  } finally {
    await pool.end();
  }
}

export async function asAdmin(page: Page, baseURL: string | undefined) {
  const { sessionToken } = creatorE2EFixtures.admin;
  await signInAgain(sessionToken);
  await useE2ESession(page.context(), baseURL ?? "", sessionToken);
}
