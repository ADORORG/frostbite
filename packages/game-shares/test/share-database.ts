import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "@frostbite/database";
import { afterAll, beforeAll } from "vitest";

import { createDrizzleGameShareRepository } from "../src/drizzle-repository.ts";

// The shares against real PostgreSQL: one pool and the repository over it.
export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const repository = createDrizzleGameShareRepository(database);
export const now = new Date("2026-11-08T12:00:00.000Z");

export function registerDatabase(): void {
  beforeAll(async () => runMigrations(environment));
  afterAll(async () => pool.end());
}

export async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  return id;
}
