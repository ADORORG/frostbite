import type { SupportedAddressType } from "./address.ts";

// The smallest value an output to each kind of address may carry for Bitcoin nodes to relay it: Bitcoin Core's dust rule at its default
// dust relay fee of 3,000 sat/kvB (policy/policy.cpp, GetDustThreshold). An output is dust when spending it would cost more than a
// third of its value: the output's own size plus the size of the input that would spend it, times 3 sat/vB. 31 + 67.75 vB for a
// P2WPKH output and its spend gives 294 sats; 43 + 57.25 vB for P2TR gives 330 sats.
const dustLimits: Readonly<Record<SupportedAddressType, bigint>> = {
  p2tr: 330n,
  p2wpkh: 294n,
};

export function dustLimitSats(type: SupportedAddressType): bigint {
  return dustLimits[type];
}
