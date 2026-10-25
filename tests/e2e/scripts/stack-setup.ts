import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import {
  applyMigrations,
  authSessions,
  authUsers,
  contactIdentities,
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
  seededEmails,
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
  return Object.entries(creatorE2EFixtures)
    .filter(([key]) => !administrationKeys.includes(key))
    .map(([key, fixture]) => ({
      email: `${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}@example.test`,
      fixture,
      name: `E2E ${key}`,
    }));
}

// The administrator and the person to give a role to. Seeded on their own, and only where missing, so a stack that keeps its data from
// before they existed gets them without being wiped.
const administrationKeys = ["admin", "roleCandidate"];

export async function seedAdministration(
  database: ReturnType<typeof createDatabaseClient>,
): Promise<void> {
  const expiry = new Date("2099-01-01T00:00:00.000Z");
  const people = [
    { fixture: creatorE2EFixtures.admin, name: "E2E administrator" },
    { fixture: creatorE2EFixtures.roleCandidate, name: "E2E role candidate" },
  ] as const;
  await database
    .insert(authUsers)
    .values(
      people.map(({ fixture, name }) => ({
        email: `contact-${fixture.userId}@contact.invalid`,
        emailVerified: true,
        id: fixture.userId,
        name,
      })),
    )
    .onConflictDoNothing();
  await database
    .insert(authSessions)
    .values(
      people.map(({ fixture }) => ({
        absoluteExpiresAt: expiry,
        authenticatedAt: new Date(),
        id: fixture.sessionId,
        idleExpiresAt: expiry,
        tokenHash: hash(fixture.sessionToken),
        userId: fixture.userId,
      })),
    )
    .onConflictDoNothing();
  await database
    .insert(platformRoleAssignments)
    .values({
      id: creatorE2EFixtures.admin.roleId,
      role: "admin",
      status: "active",
      userId: creatorE2EFixtures.admin.userId,
    })
    .onConflictDoNothing();
  await database
    .insert(contactIdentities)
    .values([
      {
        id: creatorE2EFixtures.admin.emailIdentityId,
        kind: "email",
        userId: creatorE2EFixtures.admin.userId,
        value: seededEmails.admin,
        verifiedAt: new Date(),
      },
      {
        id: creatorE2EFixtures.roleCandidate.emailIdentityId,
        kind: "email",
        userId: creatorE2EFixtures.roleCandidate.userId,
        value: seededEmails.roleCandidate,
        verifiedAt: new Date(),
      },
    ])
    .onConflictDoNothing();
  // The administrator needs a wallet for the role to work (ADR-021).
  await database
    .insert(walletIdentities)
    .values({
      address: "tb1qe2eadmin",
      id: creatorE2EFixtures.admin.walletId,
      network: "signet",
      scriptIdentity: "0014e2eadmin",
      userId: creatorE2EFixtures.admin.userId,
      walletAdapter: "e2e-fixture",
    })
    .onConflictDoNothing();
}

// Makes a seeded session usable again: signing out in the web app revokes the row, and the stack's tokens are fixed, so the same token
// would otherwise be refused for good. The idle window starts again from now, and so does the sign-in itself: picking a person is
// signing in as them, and changes to sign-in methods and roles need a recent sign-in.
export async function reviveSession(
  database: ReturnType<typeof createDatabaseClient>,
  token: string,
  now: Date = new Date(),
): Promise<void> {
  await database
    .update(authSessions)
    .set({
      authenticatedAt: now,
      idleExpiresAt: new Date(now.getTime() + 86_400_000),
      revokedAt: null,
    })
    .where(eq(authSessions.tokenHash, hash(token)));
}

// Seeds a database that may already hold a stack's data: migrations are applied (they only go forward), and the people and sample
// content are written only if they are not there, so a stack that keeps its data keeps what was done in it. "kept" when it already
// had them.
export async function seedOnce(
  databaseUrl: string,
): Promise<"kept" | "seeded"> {
  const pool = createDatabasePool({
    DATABASE_ACQUIRE_TIMEOUT_MS: 5_000,
    DATABASE_IDLE_TIMEOUT_MS: 1_000,
    DATABASE_POOL_MAX: 2,
    DATABASE_SSL_MODE: "disable",
    DATABASE_STATEMENT_TIMEOUT_MS: 5_000,
    DATABASE_URL: databaseUrl,
  });
  try {
    const database = createDatabaseClient(pool);
    await applyMigrations(database);
    const [present] = await database
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.id, creatorE2EFixtures.reviewer.userId));
    if (present !== undefined) {
      await seedAdministration(database);
      return "kept";
    }
  } finally {
    await pool.end();
  }
  await seed(databaseUrl);
  return "seeded";
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
    await database.insert(walletIdentities).values([
      {
        address: "tb1qe2eapplicant",
        id: "01994b10-0000-7000-8000-000000000006",
        network: "signet",
        scriptIdentity: "0014e2eapplicant",
        userId: creatorE2EFixtures.passkeyUser.userId,
        walletAdapter: "e2e-fixture",
      },
      // Staff need a wallet for their role to work (ADR-021).
      {
        address: "tb1qe2estaff",
        id: "01994b10-0000-7000-8000-000000000007",
        network: "signet",
        scriptIdentity: "0014e2estaff",
        userId: creatorE2EFixtures.staff.userId,
        walletAdapter: "e2e-fixture",
      },
    ]);
    await seedAdministration(database);
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
