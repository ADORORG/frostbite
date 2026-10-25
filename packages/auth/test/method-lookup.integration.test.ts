import { randomUUID } from "node:crypto";

import {
  authUsers,
  contactIdentities,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
  walletIdentities,
} from "@ador/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { emailMethod } from "../src/contacts/method.ts";
import { createMethodRegistry } from "../src/methods/registry.ts";
import { passkeyMethod } from "../src/passkeys/method.ts";
import { shortenAddress } from "../src/wallets/short-address.ts";
import { walletMethod } from "../src/wallets/method.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const registry = createMethodRegistry([
  walletMethod,
  passkeyMethod,
  emailMethod,
]);

beforeAll(async () => runMigrations(environment));
afterAll(async () => pool.end());

const unique = () => randomUUID().replaceAll("-", "").slice(0, 12);
async function account(options: { email?: string; wallet?: string } = {}) {
  const userId = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${userId}@example.test`, id: userId, name: "Test" });
  if (options.wallet !== undefined)
    await database.insert(walletIdentities).values({
      address: options.wallet,
      id: randomUUID(),
      network: "signet",
      scriptIdentity: `script-${options.wallet}`,
      userId,
      walletAdapter: "xverse",
    });
  if (options.email !== undefined)
    await database.insert(contactIdentities).values({
      id: randomUUID(),
      kind: "email",
      userId,
      value: options.email,
      verifiedAt: new Date(),
    });
  return userId;
}
const label = (userId: string) =>
  database.transaction((tx) => registry.label(tx, userId));
const lookup = (text: string) =>
  database.transaction((tx) => registry.lookup(tx, text));

describe("naming an account", () => {
  it("uses a shortened wallet address, or the email address when there is no wallet, or nothing", async () => {
    const wallet = `tb1q${unique()}${unique()}${unique()}`;
    const withWallet = await account({
      email: `a-${unique()}@example.test`,
      wallet,
    });
    expect(await label(withWallet)).toBe(shortenAddress(wallet));
    const address = `b-${unique()}@example.test`;
    expect(await label(await account({ email: address }))).toBe(address);
    expect(await label(await account())).toBeNull();
  });

  it("names an account by the wallet linked first, not the latest", async () => {
    const userId = await account();
    const first = `tb1q${unique()}${unique()}aa`;
    const second = `tb1q${unique()}${unique()}bb`;
    for (const [address, linkedAt] of [
      [second, new Date("2026-10-02T00:00:00.000Z")],
      [first, new Date("2026-10-01T00:00:00.000Z")],
    ] as const)
      await database.insert(walletIdentities).values({
        address,
        createdAt: linkedAt,
        id: randomUUID(),
        network: "signet",
        scriptIdentity: `script-${address}`,
        userId,
        walletAdapter: "xverse",
      });
    expect(await label(userId)).toBe(shortenAddress(first));
  });

  it("shortens only an address that is long enough to shorten", () => {
    expect(shortenAddress("tb1quh9vv9008jqcct245xc98rp73qkjjfapr5eya8")).toBe(
      "tb1quh…eya8",
    );
    expect(shortenAddress("tb1qshort")).toBe("tb1qshort");
    expect(shortenAddress("a".repeat(11))).toBe("a".repeat(11));
    expect(shortenAddress("a".repeat(12))).toBe("aaaaaa…aaaa");
  });
});

describe("finding an account by what is typed", () => {
  it("finds the account with that wallet address, as typed with spaces around it", async () => {
    const wallet = `tb1q${unique()}${unique()}`;
    const userId = await account({ wallet });
    expect(await lookup(` ${wallet} `)).toEqual([userId]);
    expect(await lookup(`${wallet}x`)).toEqual([]);
  });

  it("finds the account with that email address however it is written, and none for something that is not an address", async () => {
    const address = `c-${unique()}@example.test`;
    const userId = await account({ email: address });
    expect(await lookup(`  ${address.toUpperCase()} `)).toEqual([userId]);
    expect(await lookup("not an address")).toEqual([]);
    expect(await lookup(`other-${unique()}@example.test`)).toEqual([]);
  });

  it("does not find an address held under another kind of method", async () => {
    const value = `e-${unique()}@example.test`;
    const userId = randomUUID();
    await database
      .insert(authUsers)
      .values({ email: `${userId}@example.test`, id: userId, name: "Test" });
    await database.insert(contactIdentities).values({
      id: randomUUID(),
      kind: "phone",
      userId,
      value,
      verifiedAt: new Date(),
    });
    expect(await lookup(value)).toEqual([]);
  });

  it("finds every account the text names across methods, each once", async () => {
    const same = `d-${unique()}@example.test`;
    const emailOwner = await account({ email: same });
    expect(await lookup(same)).toEqual([emailOwner]);
  });
});
