import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "@frostbite/database";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { expectToWait, holdTransaction, pause } from "../src/race.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);

beforeAll(() => runMigrations(environment));
afterAll(async () => {
  await database.delete(authUsers);
  await pool.end();
});

async function user() {
  const id = createUuidV7();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Racer" });
  return id;
}

describe("race helpers", () => {
  it("keep a transaction open until released, and a waiting attempt waits for it", async () => {
    const id = await user();
    const holder = await holdTransaction(database, (transaction) =>
      transaction
        .update(authUsers)
        .set({ name: "Held" })
        .where(eq(authUsers.id, id)),
    );
    const outcome = await expectToWait(holder, async () => {
      await database
        .update(authUsers)
        .set({ name: "After" })
        .where(eq(authUsers.id, id));
      return "done" as const;
    });
    expect(outcome).toBe("done");
    const [row] = await database
      .select({ name: authUsers.name })
      .from(authUsers)
      .where(eq(authUsers.id, id));
    expect(row?.name).toBe("After");
  });

  it("fail an attempt that does not wait for what the holder took", async () => {
    const id = await user();
    const other = await user();
    const holder = await holdTransaction(database, (transaction) =>
      transaction
        .update(authUsers)
        .set({ name: "Held" })
        .where(eq(authUsers.id, id)),
    );
    // Touching a different row is not blocked, so the helper reports it did not wait.
    await expect(
      expectToWait(
        holder,
        () =>
          database
            .update(authUsers)
            .set({ name: "Unrelated" })
            .where(eq(authUsers.id, other)),
        100,
      ),
    ).rejects.toThrow();
    // The helper released the holder even though the check failed, so its transaction is finished.
    await expect(holder.finished).resolves.toBeUndefined();
  });

  it("pause waits at least the time asked", async () => {
    const started = Date.now();
    await pause(50);
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  });
});
