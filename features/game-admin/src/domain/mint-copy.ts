import type { SetPlatformFeeResponse } from "@frostbite/shared/games";

// Whole units of the chain's smallest denomination as people read them: grouped digits and the unit's name. The platform's chain is
// Bitcoin, so the unit is the satoshi.
export const unitsLabel = (units: string): string =>
  `${BigInt(units).toLocaleString("en-US")} sats`;

// What a refused fee setting means to staff, and what to do about it.
export function platformFeeRefusalCopy(
  refusal: Extract<SetPlatformFeeResponse, { status: "refused" }>,
): string {
  const limit =
    refusal.limitUnits === undefined ? "" : unitsLabel(refusal.limitUnits);
  switch (refusal.reason) {
    case "above-maximum":
      return `That fee is above the most the platform allows (${limit}). Nothing was changed.`;
    case "below-minimum-output":
      return `A fee that small cannot be paid: the network does not relay a payment under ${limit} to that address. Use at least ${limit}, or 0 for no fee. Nothing was changed.`;
    case "chain-unavailable":
      return "The platform cannot check an address on that network right now. Try again shortly. Nothing was changed.";
    case "invalid-address":
      return "That is not an address on this network. Check it and try again. Nothing was changed.";
    case "unknown-chain":
      return "No game is on that network, so there is no fee to set for it. Nothing was changed.";
  }
}

// A wallet address as a list shows it: the ends, so two can be told apart and none fills a row.
export function shortAddress(address: string): string {
  return address.length <= 18
    ? address
    : `${address.slice(0, 8)}…${address.slice(-6)}`;
}
