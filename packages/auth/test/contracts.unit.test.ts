import { validateBitcoinAddress } from "@frostbite/chain/bitcoin";
import { uuidV7Schema } from "@frostbite/shared/identifiers";
import { describe, expect, it } from "vitest";

import {
  BIP322_SIGNATURE_SCHEME,
  WALLET_CHALLENGE_SCHEMA_VERSION,
} from "../src/domain/contracts.ts";
import { serializeWalletChallenge } from "../src/domain/serialize-challenge.ts";

const address = validateBitcoinAddress(
  "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v",
  "signet",
);

describe("wallet challenge serialization", () => {
  it("serializes every bound field deterministically", () => {
    if (!address.ok) throw new Error("Fixture address must be valid");
    const message = serializeWalletChallenge({
      action: "sign-in",
      address: address.value.address,
      challengeId: uuidV7Schema.parse("01941f29-7c00-73e4-a310-744d2167fc5b"),
      domain: "launch.example",
      expiresAt: new Date("2026-09-08T12:05:00.000Z"),
      issuedAt: new Date("2026-09-08T12:00:00.000Z"),
      network: "signet",
      nonce: "n-7Q9wP3",
      origin: "https://launch.example",
      requestId: uuidV7Schema.parse("01941f29-7c01-73e4-a310-744d2167fc5b"),
      schemaVersion: WALLET_CHALLENGE_SCHEMA_VERSION,
      signatureScheme: BIP322_SIGNATURE_SCHEME,
      uri: "https://launch.example/auth",
    });

    expect(message).toMatchInlineSnapshot(`
      "launch.example requests a Bitcoin wallet signature.
      This request will not create or broadcast a transaction.

      URI: https://launch.example/auth
      Origin: https://launch.example
      Address: tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v
      Network: signet
      Action: sign-in
      Nonce: n-7Q9wP3
      Issued At: 2026-09-08T12:00:00.000Z
      Expires At: 2026-09-08T12:05:00.000Z
      Request ID: 01941f29-7c01-73e4-a310-744d2167fc5b
      Challenge ID: 01941f29-7c00-73e4-a310-744d2167fc5b
      Schema Version: 1
      Signature Scheme: bip322-simple"
    `);
  });
});
