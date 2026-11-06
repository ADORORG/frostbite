import { validateBitcoinAddress } from "@frostbite/chain/bitcoin";
import { Signer } from "bip322-js";
import { describe, expect, it } from "vitest";

import { strictBip322Verifier } from "../src/bitcoin/verifier.ts";

const privateKey = "L3VFeEujGtevx9w18HD1fhRbCH67Az2dpCymeRE1SoPK6XQtaN2k";
const candidate = "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v";
const address = validateBitcoinAddress(candidate, "signet");

describe("strict BIP-322 verification", () => {
  it("accepts a real simple-signature fixture and rejects mutations", () => {
    if (!address.ok) throw new Error("Fixture address must be valid");
    const message = "canonical challenge";
    const signature = Signer.sign(privateKey, candidate, message);

    expect(
      strictBip322Verifier.verify({
        address: address.value.address,
        message,
        signature,
      }),
    ).toBe(true);
    expect(
      strictBip322Verifier.verify({
        address: address.value.address,
        message: `${message}-mutated`,
        signature,
      }),
    ).toBe(false);
    expect(
      strictBip322Verifier.verify({
        address: address.value.address,
        message,
        signature: "malformed",
      }),
    ).toBe(false);
  });
});
