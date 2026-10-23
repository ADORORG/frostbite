import { walletNetworks } from "@ador/shared/chain";
import { PgDialect, pgTable, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { networkInList } from "../src/schema/network-check.ts";

const wallets = pgTable("wallets", { network: text("network").notNull() });

describe("the wallet network CHECK", () => {
  it("allows exactly the networks a wallet can be on, testnet4 among them", () => {
    const { params, sql } = new PgDialect().sqlToQuery(
      networkInList(wallets.network),
    );
    expect(params).toEqual([]);
    expect(sql).toBe(
      `"wallets"."network" in ('mainnet', 'signet', 'testnet4')`,
    );
    for (const network of walletNetworks) expect(sql).toContain(`'${network}'`);
    expect(sql).not.toContain("regtest");
  });
});
