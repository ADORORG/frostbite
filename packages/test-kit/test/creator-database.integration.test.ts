import {
  assetDerivatives,
  assets,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  creatorApplications,
  parseDatabaseEnvironment,
  platformRoleAssignments,
  runMigrations,
  uploadIntents,
} from "@ador/database";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  seedCreatorUser,
  seedDerivative,
  seedPlatformUser,
  seedUploadedAsset,
  setCreatorApplicationState,
} from "../src/creator-database.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const now = new Date("2026-10-09T12:00:00.000Z");

beforeAll(() => runMigrations(environment));
afterAll(async () => {
  await database.delete(assetDerivatives);
  await database.delete(assets);
  await database.delete(uploadIntents);
  await database.delete(creatorApplications);
  await database.delete(platformRoleAssignments);
  await database.delete(authUsers);
  await pool.end();
});

const stateOf = async (userId: string) =>
  (
    await database
      .select({ state: creatorApplications.state })
      .from(creatorApplications)
      .where(eq(creatorApplications.applicantUserId, userId))
  ).map(({ state }) => state);

describe("creator database fixtures", () => {
  it("seeds a user with an approved application by default, and changes its state", async () => {
    const userId = await seedCreatorUser(database);
    expect(await stateOf(userId)).toEqual(["approved"]);
    await setCreatorApplicationState(database, userId, "suspended");
    expect(await stateOf(userId)).toEqual(["suspended"]);
  });

  it("seeds a user with an active platform role, or a suspended or different one", async () => {
    const rolesOf = async (userId: string) =>
      (
        await database
          .select({
            role: platformRoleAssignments.role,
            status: platformRoleAssignments.status,
          })
          .from(platformRoleAssignments)
          .where(eq(platformRoleAssignments.userId, userId))
      ).map(({ role, status }) => `${role}:${status}`);
    expect(await rolesOf(await seedPlatformUser(database))).toEqual([
      "reviewer:active",
    ]);
    expect(
      await rolesOf(await seedPlatformUser(database, "staff", "suspended")),
    ).toEqual(["staff:suspended"]);
  });

  it("seeds a user who never applied, or one in any other state", async () => {
    expect(await stateOf(await seedCreatorUser(database, null))).toEqual([]);
    expect(await stateOf(await seedCreatorUser(database, "draft"))).toEqual([
      "draft",
    ]);
  });

  it.each(["processed", "validated", "pending-validation"] as const)(
    "seeds a %s asset the database accepts",
    async (state) => {
      const userId = await seedCreatorUser(database);
      const assetId = await seedUploadedAsset(database, {
        now,
        purpose: "collection-artwork",
        state,
        userId,
      });
      const [row] = await database
        .select()
        .from(assets)
        .where(eq(assets.id, assetId));
      expect(row).toMatchObject({ processingState: state, userId });
      expect(row?.processingCompletedAt !== null).toBe(state === "processed");
    },
  );

  it("defaults to a processed asset and can give it a rendition", async () => {
    const userId = await seedCreatorUser(database);
    const assetId = await seedUploadedAsset(database, {
      now,
      purpose: "collection-item-artwork",
      userId,
    });
    const key = await seedDerivative(database, assetId, "thumbnail");
    const [derivative] = await database
      .select()
      .from(assetDerivatives)
      .where(eq(assetDerivatives.assetId, assetId));
    expect(derivative).toMatchObject({ kind: "thumbnail", objectKey: key });
    const [asset] = await database
      .select()
      .from(assets)
      .where(eq(assets.id, assetId));
    expect(asset?.processingState).toBe("processed");
  });
});
