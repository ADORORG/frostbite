import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import {
  applyMigrations,
  authSessions,
  authUsers,
  createDatabaseClient,
  creatorApplications,
  createDatabasePool,
  platformRoleAssignments,
  walletIdentities,
} from "@ador/database";
import { creatorApplicationFixture } from "@ador/test-kit/creator-database";

import {
  approvedCreators,
  creatorE2EFixtures,
} from "../src/creator-fixtures.ts";
import { seedFeedbackApplication } from "./feedback-seed.ts";
import { seedPublicCollection } from "./public-collection-seed.ts";

// Seeding and application environment shared by every script that runs the real stack: the browser
// test run and the local manual-test stack. One place, so the two cannot drift apart.

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Every actor the browser specs sign in as, derived from the fixtures so a new fixture is seeded
// automatically. One list drives both the user and the session rows.
function seededActors() {
  return Object.entries(creatorE2EFixtures).map(([key, fixture]) => ({
    email: `${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}@example.test`,
    fixture,
    name: `E2E ${key}`,
  }));
}

// Makes a seeded session usable again: signing out in the web app revokes the row, and the stack's tokens are fixed, so the same token
// would otherwise be refused for good. The idle window starts again from now.
export async function reviveSession(
  database: ReturnType<typeof createDatabaseClient>,
  token: string,
  now: Date = new Date(),
): Promise<void> {
  await database
    .update(authSessions)
    .set({
      idleExpiresAt: new Date(now.getTime() + 86_400_000),
      revokedAt: null,
    })
    .where(eq(authSessions.tokenHash, hash(token)));
}

export async function seed(databaseUrl: string): Promise<void> {
  const pool = createDatabasePool({
    DATABASE_ACQUIRE_TIMEOUT_MS: 5_000,
    DATABASE_IDLE_TIMEOUT_MS: 1_000,
    DATABASE_POOL_MAX: 4,
    DATABASE_SSL_MODE: "disable",
    DATABASE_STATEMENT_TIMEOUT_MS: 5_000,
    DATABASE_URL: databaseUrl,
  });
  try {
    const database = createDatabaseClient(pool);
    await applyMigrations(database);
    const expiry = new Date("2099-01-01T00:00:00.000Z");
    const actors = seededActors();
    await database.insert(authUsers).values(
      actors.map(({ email, fixture, name }) => ({
        email,
        emailVerified: true,
        id: fixture.userId,
        name,
      })),
    );
    await database.insert(authSessions).values(
      actors.map(({ fixture }) => ({
        absoluteExpiresAt: expiry,
        authenticatedAt: new Date(),
        id: fixture.sessionId,
        idleExpiresAt: expiry,
        tokenHash: hash(fixture.sessionToken),
        userId: fixture.userId,
      })),
    );
    await database.insert(creatorApplications).values(
      approvedCreators.map(({ userId }, index) => ({
        applicantUserId: userId,
        draft: creatorApplicationFixture,
        id: `01994b10-0000-7000-8000-0000000000${(0x30 + index).toString(16)}`,
        state: "approved" as const,
      })),
    );
    await database.insert(platformRoleAssignments).values([
      {
        id: creatorE2EFixtures.reviewer.roleId,
        role: "reviewer",
        status: "active",
        userId: creatorE2EFixtures.reviewer.userId,
      },
      {
        id: creatorE2EFixtures.staff.roleId,
        role: "staff",
        status: "active",
        userId: creatorE2EFixtures.staff.userId,
      },
    ]);
    await seedFeedbackApplication(database);
    await seedPublicCollection(database);
    await database.insert(walletIdentities).values({
      address: "tb1qe2eapplicant",
      id: "01994b10-0000-7000-8000-000000000006",
      network: "signet",
      scriptIdentity: "0014e2eapplicant",
      userId: creatorE2EFixtures.passkeyUser.userId,
      walletAdapter: "e2e-fixture",
    });
  } finally {
    await pool.end();
  }
}

export function applicationEnvironment(
  databaseUrl: string,
  baseURL: string,
): NodeJS.ProcessEnv {
  return {
    APP_ENV: "test",
    AUTH_SESSION_ABSOLUTE_TIMEOUT_MS: "604800000",
    AUTH_SESSION_IDLE_TIMEOUT_MS: "86400000",
    DATABASE_ACQUIRE_TIMEOUT_MS: "5000",
    DATABASE_IDLE_TIMEOUT_MS: "1000",
    DATABASE_MIGRATION_URL: "",
    DATABASE_POOL_MAX: "4",
    DATABASE_SSL_MODE: "disable",
    DATABASE_STATEMENT_TIMEOUT_MS: "5000",
    DATABASE_URL: databaseUrl,
    NEXT_PUBLIC_APP_NAME: "Adorbitals E2E",
    PASSKEY_CHALLENGE_TIMEOUT_MS: "300000",
    PASSKEY_RECENT_AUTH_WINDOW_MS: "600000",
    PUBLIC_BASE_URL: baseURL,
    // No proxy stands in front of the app here, so the address the framework reports is the test's own, shared
    // by every test; counting by it would make unrelated tests limit each other.
    TRUSTED_PROXY_HOPS: "0",
  };
}
