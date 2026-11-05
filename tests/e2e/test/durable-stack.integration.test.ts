import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
} from "@frostbite/database";
import { runDocker } from "@frostbite/test-kit/docker";
import { findContainer, wipe } from "@frostbite/test-kit/durable-container";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { withDurablePostgres } from "../src/durable-stack.ts";
import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { seedOnce } from "../scripts/stack-setup.ts";

// Real Docker, with names of its own, so a stack that is running on this machine is never touched.
const id = randomUUID().slice(0, 8);
const names = {
  container: `frostbite-test-keep-${id}`,
  volume: `frostbite-test-keep-${id}-data`,
};
let directory = "";
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "stack-"));
});
afterEach(async () => {
  await wipe({ containers: [names.container], volumes: [names.volume] });
  await rm(directory, { force: true, recursive: true });
});

const openPool = (url: string) =>
  createDatabasePool({
    DATABASE_ACQUIRE_TIMEOUT_MS: 5_000,
    DATABASE_IDLE_TIMEOUT_MS: 1_000,
    DATABASE_POOL_MAX: 2,
    DATABASE_SSL_MODE: "disable",
    DATABASE_STATEMENT_TIMEOUT_MS: 5_000,
    DATABASE_URL: url,
  });

describe("a database the stack keeps", () => {
  it("is still there, with its data, after the run ends and another starts; the seed is not done twice; and wiping really deletes it", async () => {
    let first = "";
    await withDurablePostgres({ directory, names }, async (url, kept) => {
      expect(kept).toBe(false);
      expect(await seedOnce(url)).toBe("seeded");
      first = url;
    });
    // Stopped, not removed.
    expect(await findContainer(names.container)).toBe("stopped");

    await withDurablePostgres({ directory, names }, async (url, kept) => {
      expect(kept).toBe(true);
      expect(url).not.toBe("");
      expect(await seedOnce(url)).toBe("kept");
      const pool = openPool(url);
      try {
        const rows = await createDatabaseClient(pool)
          .select({ id: authUsers.id })
          .from(authUsers);
        expect(rows.length).toBeGreaterThan(5);
        expect(rows.map((row) => row.id)).toContain(
          creatorE2EFixtures.reviewer.userId,
        );
      } finally {
        await pool.end();
      }
    });
    expect(first).toContain("127.0.0.1");

    await wipe({ containers: [names.container], volumes: [names.volume] });
    expect(await findContainer(names.container)).toBe("missing");
    expect(
      await runDocker([
        "volume",
        "ls",
        "--quiet",
        "--filter",
        `name=${names.volume}`,
      ]),
    ).toBe("");
  }, 180_000);
});
