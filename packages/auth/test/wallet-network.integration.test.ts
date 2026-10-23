import { walletIdentities } from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it } from "vitest";

import {
  database,
  registerAuthDatabase,
  service,
  verifyIssued,
} from "./support/auth-database.ts";
import { validChallengeInput } from "./support/fixtures.ts";

registerAuthDatabase();

describe("a wallet on testnet4", () => {
  it("signs in, and the identity is kept with the network it signed in from", async () => {
    const issued = await service.issue({
      ...validChallengeInput(),
      network: "testnet4",
    });
    if (issued === null) throw new Error("A testnet4 challenge was refused");
    const result = await verifyIssued(issued);
    expect(result.ok).toBe(true);
    const identities = await database.select().from(walletIdentities);
    expect(identities.map(({ network }) => network)).toEqual(["testnet4"]);
  });

  it("is not told apart from signet by its address, so the same address is a separate identity on each", async () => {
    for (const network of ["signet", "testnet4"] as const) {
      const issued = await service.issue({
        ...validChallengeInput(),
        network,
        requestId: createUuidV7(),
      });
      if (issued === null) throw new Error(`A ${network} challenge failed`);
      expect((await verifyIssued(issued)).ok).toBe(true);
    }
    const identities = await database.select().from(walletIdentities);
    expect(identities.map(({ network }) => network).sort()).toEqual([
      "signet",
      "testnet4",
    ]);
  });

  it("is refused by the database for a network a wallet cannot be on", async () => {
    const issued = await service.issue(validChallengeInput());
    if (issued === null) throw new Error("A signet challenge was refused");
    await verifyIssued(issued);
    const [stored] = await database.select().from(walletIdentities);
    if (stored === undefined) throw new Error("Expected a stored identity");
    const refusal = await database
      .insert(walletIdentities)
      .values({
        ...stored,
        id: createUuidV7(),
        network: "regtest",
        scriptIdentity: "regtest-script",
      })
      .catch((error: unknown) => error);
    // The refusal is the network CHECK's, not some other column's.
    expect(refusal).toBeInstanceOf(Error);
    expect(refusal instanceof Error ? String(refusal.cause) : "").toContain(
      "wallet_identities_network_supported",
    );
  });
});
