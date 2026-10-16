import { crypto } from "bitcoinjs-lib";

import { littleEndian } from "./node/numbers.ts";

// The number the contracts know a milestone by: the first 16 bytes of the SHA-256 of its id's UTF-8 bytes, read as a
// little-endian integer. `contracts/templates/rewards-core/src/key.rs` implements the same rule; both are tested against
// `contracts/templates/abi/milestone-key-vectors.json`.
export function milestoneKey(milestoneId: string): bigint {
  const digest = crypto.sha256(new TextEncoder().encode(milestoneId));
  return littleEndian(digest.subarray(0, 16));
}
