import { describe, expect, it } from "vitest";

import type { DatabaseEnvironment } from "../src/connection/config.ts";
import { createDatabaseFromEnvironment } from "../src/connection/from-environment.ts";
import { toPoolConfig } from "../src/connection/pool.ts";

const environment: DatabaseEnvironment = {
  DATABASE_URL: "postgresql://app:secret@database.invalid/app",
  DATABASE_MIGRATION_URL: "",
  DATABASE_SSL_MODE: "disable",
  DATABASE_POOL_MAX: 8,
  DATABASE_ACQUIRE_TIMEOUT_MS: 4000,
  DATABASE_IDLE_TIMEOUT_MS: 20000,
  DATABASE_STATEMENT_TIMEOUT_MS: 12000,
};

describe("PostgreSQL pool configuration", () => {
  it("maps every typed setting without provider-specific branches", () => {
    expect(toPoolConfig(environment)).toEqual({
      connectionString: environment.DATABASE_URL,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 20000,
      max: 8,
      ssl: false,
      statement_timeout: 12000,
    });
  });

  it.each([
    ["require", false],
    ["verify-full", true],
  ] as const)("maps %s TLS mode", (mode, rejectUnauthorized) => {
    expect(
      toPoolConfig({ ...environment, DATABASE_SSL_MODE: mode }).ssl,
    ).toEqual({ rejectUnauthorized });
  });

  it("allows an explicit migration connection without changing policy", () => {
    const migrationUrl = "postgresql://migrator:secret@database.invalid/app";

    expect(toPoolConfig(environment, migrationUrl).connectionString).toBe(
      migrationUrl,
    );
  });
});

describe("database client from environment", () => {
  it("builds a client from a valid environment without connecting", () => {
    const client = createDatabaseFromEnvironment({
      ...environment,
      DATABASE_POOL_MAX: String(environment.DATABASE_POOL_MAX),
      DATABASE_ACQUIRE_TIMEOUT_MS: String(
        environment.DATABASE_ACQUIRE_TIMEOUT_MS,
      ),
      DATABASE_IDLE_TIMEOUT_MS: String(environment.DATABASE_IDLE_TIMEOUT_MS),
      DATABASE_STATEMENT_TIMEOUT_MS: String(
        environment.DATABASE_STATEMENT_TIMEOUT_MS,
      ),
    });
    expect(typeof client.transaction).toBe("function");
  });

  it("fails fast when a required setting is missing", () => {
    expect(() => createDatabaseFromEnvironment({})).toThrow();
  });
});
