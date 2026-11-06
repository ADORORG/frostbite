import { address, networks, opcodes, script } from "bitcoinjs-lib";

import type { BitcoinNetwork } from "@frostbite/shared/chain";

export type { BitcoinNetwork };

// What tells one network's addresses from another's: the bech32 prefix (BIP-173) and the legacy version bytes. Signet and testnet4
// share testnet's, so an address cannot say which of the three it is for; the chain a request names does.
const addressRules = {
  mainnet: { legacy: networks.bitcoin, prefix: "bc" },
  regtest: { legacy: networks.regtest, prefix: "bcrt" },
  signet: { legacy: networks.testnet, prefix: "tb" },
  testnet4: { legacy: networks.testnet, prefix: "tb" },
} as const satisfies Record<
  BitcoinNetwork,
  { readonly legacy: typeof networks.bitcoin; readonly prefix: string }
>;
export type SupportedAddressType = "p2tr" | "p2wpkh";

declare const validatedAddressBrand: unique symbol;

export type ValidatedBitcoinAddress = string & {
  readonly [validatedAddressBrand]: true;
};

export interface BitcoinAddress {
  readonly address: ValidatedBitcoinAddress;
  readonly network: BitcoinNetwork;
  readonly scriptHex: string;
  readonly type: SupportedAddressType;
}

export type AddressValidationResult =
  | { readonly ok: true; readonly value: BitcoinAddress }
  | {
      readonly code: "invalid-address" | "unsupported-address-type";
      readonly ok: false;
    };

function classifyWitness(
  version: number,
  program: Uint8Array,
): SupportedAddressType | undefined {
  if (version === 0 && program.length === 20) {
    return "p2wpkh";
  }
  if (version === 1 && program.length === 32) {
    return "p2tr";
  }
  return undefined;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function validateBitcoinAddress(
  candidate: string,
  network: BitcoinNetwork,
): AddressValidationResult {
  if (candidate.length === 0 || candidate !== candidate.trim()) {
    return { code: "invalid-address", ok: false };
  }

  try {
    const expectedPrefix = addressRules[network].prefix;
    const decoded = address.fromBech32(candidate);
    if (decoded.prefix !== expectedPrefix) {
      return { code: "invalid-address", ok: false };
    }
    const canonicalAddress = address.toBech32(
      decoded.data,
      decoded.version,
      decoded.prefix,
    );
    if (candidate !== canonicalAddress) {
      return { code: "invalid-address", ok: false };
    }

    const type = classifyWitness(decoded.version, decoded.data);
    if (type === undefined) {
      return { code: "unsupported-address-type", ok: false };
    }

    const outputScript = script.compile([
      type === "p2wpkh" ? opcodes.OP_0 : opcodes.OP_1,
      decoded.data,
    ]);

    // The brand is introduced only after library decoding and canonical round-trip validation.
    const validatedAddress = canonicalAddress as ValidatedBitcoinAddress;
    return {
      ok: true,
      value: {
        address: validatedAddress,
        network,
        scriptHex: bytesToHex(outputScript),
        type,
      },
    };
  } catch {
    try {
      const decoded = address.fromBase58Check(candidate);
      const expectedNetwork = addressRules[network].legacy;
      const isKnownLegacyVersion =
        decoded.version === expectedNetwork.pubKeyHash ||
        decoded.version === expectedNetwork.scriptHash;
      return isKnownLegacyVersion
        ? { code: "unsupported-address-type", ok: false }
        : { code: "invalid-address", ok: false };
    } catch {
      return { code: "invalid-address", ok: false };
    }
  }
}
