import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "@frostbite/database";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzleGameSyncRepository } from "../../src/drizzle-repository.ts";
import { createGameSyncService } from "../../src/service.ts";
import { rules } from "./rules.ts";

// The account's saved state against real PostgreSQL: one pool, the repository, and a service over it with two listed games.
export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const repository = createDrizzleGameSyncRepository(database);
export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export const now = new Date("2026-10-12T12:00:00.000Z");
export const service = createGameSyncService({
  clock: () => now,
  games: new Map([
    ["tap-tower", rules(["first-five", "ten-taps"])],
    ["other-game", rules(["first-five"])],
  ]),
  maxProgressBytes: 65_536,
  repository,
});
export const milestone = (id: string, unlockedAt: string) => ({
  id,
  unlockedAt,
  verification: "self-reported" as const,
  count: 1,
});

// The two players each test starts with, made fresh before it.
export const players = { otherId: "", userId: "" };

export async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  return id;
}

// Migrates once, starts every test from no players but these two, and closes the pool.
export function registerAccountDatabase(): void {
  beforeAll(async () => runMigrations(environment));
  beforeEach(async () => {
    await database.delete(authUsers);
    players.userId = await seedUser();
    players.otherId = await seedUser();
  });
  afterAll(async () => {
    await database.delete(authUsers);
    await pool.end();
  });
}
