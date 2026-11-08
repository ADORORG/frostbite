import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "@frostbite/database";
import { afterAll, beforeAll } from "vitest";

import { createDrizzleProfileRepository } from "../src/drizzle-repository.ts";
import type { StoredProfile } from "../src/repository.ts";

// The profiles against real PostgreSQL: one pool and the repository over it.
export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const repository = createDrizzleProfileRepository(database);
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

export const profileOf = (
  userId: string,
  name: string,
  over: Partial<StoredProfile> = {},
): StoredProfile => ({
  avatar: "fox",
  createdAt: now,
  name,
  nameChangedAt: now,
  nameKey: name.toLowerCase(),
  updatedAt: now,
  userId,
  visible: true,
  ...over,
});
