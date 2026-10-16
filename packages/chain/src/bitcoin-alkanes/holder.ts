import { crypto } from "bitcoinjs-lib";

import {
  validateBitcoinAddress,
  type BitcoinNetwork,
} from "../bitcoin/address.ts";
import { fromHex } from "./node/hex.ts";
import { littleEndian } from "./node/numbers.ts";

// Who the contract counts a claim for: the SHA-256 of the output script, as two little-endian 128-bit halves
// (`rewards_core::holder::Holder`). The contract reads the script a claim transaction pays to at output 0, so an address
// maps to exactly one holder.
export function holderHalves(
  addressText: string,
  network: BitcoinNetwork,
): readonly [bigint, bigint] | null {
  const checked = validateBitcoinAddress(addressText, network);
  if (!checked.ok) return null;
  const script = fromHex(checked.value.scriptHex);
  const digest = crypto.sha256(script);
  return [
    littleEndian(digest.subarray(0, 16)),
    littleEndian(digest.subarray(16)),
  ];
}
