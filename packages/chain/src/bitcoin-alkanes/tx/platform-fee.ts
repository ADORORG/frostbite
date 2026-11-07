import type { TransactionIntent } from "@frostbite/shared/chain";

import { validateBitcoinAddress } from "../../bitcoin/address.ts";
import type { BitcoinNetwork } from "../../bitcoin/address.ts";
import { dustLimitSats } from "../../bitcoin/dust.ts";
import { BuildRefusedError } from "../build-refused.ts";
import type { ScriptKind } from "./fees.ts";

export interface PlatformFeeOutput {
  readonly sats: bigint;
  readonly scriptHex: string;
  readonly type: ScriptKind;
}

// The output that pays the platform's fee on a milestone claim, or null when the claim carries none. The fee is whole satoshis to an
// address of a kind this adapter sizes, and it is not dust: an output the network would not relay would stop the whole claim.
export function platformFeeOutput(
  intent: Extract<TransactionIntent, { operation: "mint-milestone" }>,
  network: BitcoinNetwork,
): PlatformFeeOutput | null {
  const fee = intent.platformFee;
  if (fee === undefined) return null;
  const recipient = validateBitcoinAddress(fee.recipient.value, network);
  if (!recipient.ok) {
    throw new BuildRefusedError(
      "invalid-request",
      "The platform's fee address is not a usable address on this network.",
    );
  }
  if (fee.baseUnits < dustLimitSats(recipient.value.type)) {
    throw new BuildRefusedError(
      "invalid-request",
      "The platform's fee is below what the network relays as an output.",
    );
  }
  return {
    sats: fee.baseUnits,
    scriptHex: recipient.value.scriptHex,
    type: recipient.value.type,
  };
}
