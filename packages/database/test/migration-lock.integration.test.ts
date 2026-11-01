import { readdir } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
  toPoolConfig,
} from "../src/index.ts";
import { migrationsDirectory } from "../src/migrations/apply.ts";
import { withMigrationLock } from "../src/migrations/lock.ts";
import {
  createScratchDatabase,
  dropScratchDatabase,
} from "./support/scratch-database.ts";

const environment = parseDatabaseEnvironment(process.env);
const admin = createDatabasePool(environment);
const databaseName = "migration_lock_test";
const scratch = new URL(environment.DATABASE_URL);
scratch.pathname = `/${databaseName}`;
const scratchEnvironment = {
  ...environment,
  DATABASE_MIGRATION_URL: scratch.toString(),
};
const config = toPoolConfig(environment, scratch.toString());
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

beforeAll(async () => {
  await createScratchDatabase(admin, databaseName);
});

afterAll(async () => {
  await dropScratchDatabase(admin, databaseName);
  await admin.end();
});

describe("migrating from several processes at once", () => {
  it("lets every one finish, and records each migration once", async () => {
    await Promise.all(
      [1, 2, 3, 4].map(() => runMigrations(scratchEnvironment)),
    );
    const pool = createDatabasePool(environment, scratch.toString());
    try {
      const applied = await pool.query<{ name: string }>(
        `select name from drizzle.__drizzle_migrations order by id`,
      );
      const onDisk = (await readdir(migrationsDirectory)).sort((a, b) =>
        a.localeCompare(b),
      );
      expect(applied.rows.map(({ name }) => name)).toEqual(onDisk);
    } finally {
      await pool.end();
    }
  });
});

describe("the migration lock", () => {
  it("lets one holder work at a time, in the order they asked", async () => {
    const events: string[] = [];
    const hold = (name: string, ms: number) =>
      withMigrationLock(config, async () => {
        events.push(`${name} in`);
        await sleep(ms);
        events.push(`${name} out`);
      });
    const first = hold("a", 300);
    await sleep(100);
    await Promise.all([first, hold("b", 0)]);
    expect(events).toEqual(["a in", "a out", "b in", "b out"]);
  });

  it("returns what the work returns, and is free again after the work fails", async () => {
    await expect(
      withMigrationLock(config, () => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
    await expect(withMigrationLock(config, async () => 7)).resolves.toBe(7);
  });

  it("gives up waiting on a holder that does not finish", async () => {
    let release: () => void = () => undefined;
    const held = withMigrationLock(
      config,
      () =>
        new Promise<void>((done) => {
          release = () => done();
        }),
    );
    await sleep(100);
    const asked = Date.now();
    await expect(
      withMigrationLock(config, async () => "never", 200),
    ).rejects.toThrow(/statement timeout/);
    // Within the wait it was given, not the pool's own statement timeout.
    expect(Date.now() - asked).toBeLessThan(2_000);
    release();
    await held;
  });
});
