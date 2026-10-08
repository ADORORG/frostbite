import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

import {
  applyMigrations,
  authSessions,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  platformRoleAssignments,
  walletIdentities,
} from "@ador/database";
import { withDisposablePostgres } from "../../../packages/database/test/support/postgres-container.ts";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { normalizePlaywrightArguments } from "../src/playwright-arguments.ts";
import { resolveE2EServerConfig } from "../src/server-config.ts";
import { withUploadServices } from "../src/services.ts";

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

async function seed(databaseUrl: string): Promise<void> {
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

function applicationEnvironment(
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
  };
}

async function runPlaywright(
  baseEnvironment: NodeJS.ProcessEnv,
  serviceEnvironment: NodeJS.ProcessEnv,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "exec",
        "playwright",
        "test",
        ...normalizePlaywrightArguments(process.argv.slice(2)),
      ],
      {
        env: { ...process.env, ...baseEnvironment, ...serviceEnvironment },
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Playwright exited with code ${String(code)}`));
    });
  });
}

await withDisposablePostgres(async (databaseUrl) => {
  await seed(databaseUrl);
  const { baseURL } = resolveE2EServerConfig(process.env.E2E_BASE_URL);
  const baseEnvironment = applicationEnvironment(databaseUrl, baseURL);
  await withUploadServices(
    { baseEnvironment, webOrigin: new URL(baseURL).origin },
    (serviceEnvironment) => runPlaywright(baseEnvironment, serviceEnvironment),
  );
});
