import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  passkeyCredentials,
  runMigrations,
  walletIdentities,
} from "@frostbite/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { methodRegistry } from "./support/registry.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);

beforeAll(async () => runMigrations(environment));
afterAll(async () => pool.end());

describe("the wallet and passkey methods, read from the database", () => {
  it("lists what an account holds under each kind, with the capabilities each kind declares, and nothing of another account", async () => {
    const userId = randomUUID();
    const otherId = randomUUID();
    for (const id of [userId, otherId])
      await database
        .insert(authUsers)
        .values({ email: `${id}@example.test`, id, name: "Test" });
    const walletId = randomUUID();
    await database.insert(walletIdentities).values({
      address: `tb1q${walletId.replaceAll("-", "").slice(0, 30)}`,
      id: walletId,
      network: "signet",
      scriptIdentity: `script-${walletId}`,
      userId,
      walletAdapter: "xverse",
    });
    await database.insert(passkeyCredentials).values({
      backedUp: false,
      counter: 0,
      credentialId: `cred-${walletId}`,
      deviceType: "singleDevice",
      id: randomUUID(),
      publicKey: Buffer.from("key"),
      transports: [],
      userId,
    });
    const listed = await database.transaction((transaction) =>
      methodRegistry.list(transaction, userId),
    );
    expect(listed).toEqual([
      { assurance: "strong", canSignIn: true, id: walletId, kind: "wallet" },
      {
        assurance: "strong",
        canSignIn: true,
        id: `cred-${walletId}`,
        kind: "passkey",
      },
    ]);
    expect(
      await database.transaction((transaction) =>
        methodRegistry.list(transaction, otherId),
      ),
    ).toEqual([]);
  });
});
