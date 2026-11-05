import {
  BuildRefusedError,
  ChainUnavailableError,
} from "@frostbite/chain/ports";

import type { StartClaimResult } from "./types.ts";

type Refused = Extract<StartClaimResult, { readonly ok: false }>["code"];

// What the game's contract says when it would refuse a claim, in its own words: `contracts/templates/rewards-core/src/policy.rs`
// (`Refusal::message`). The adapter hands them on without the runtime's wrapping. A refusal in any other words is still a refusal,
// just not one this knows how to explain.
const contractRefusals: readonly (readonly [string, Refused])[] = [
  ["claims are paused", "claims-paused"],
  ["unknown milestone", "milestone-not-defined"],
  ["claim limit reached", "limit-reached"],
];

// Why the contract would refuse the claim, as something a player can act on or be told.
export function contractRefusal(reason: string): Refused {
  const said = reason.toLowerCase();
  return (
    contractRefusals.find(([words]) => said.includes(words))?.[1] ??
    "contract-refused"
  );
}

// Why building the claim failed. A wallet with no confirmed coins, or a fee above the platform's limit, is something the player can fix
// and is said so, and so is an index that is behind the chain; anything else (the network not answering, or something unexpected) is
// "unavailable", and the caller reports it.
export function buildFailure(error: unknown): {
  readonly code: Refused;
  readonly expected: boolean;
} {
  if (error instanceof BuildRefusedError) {
    if (error.code === "insufficient-funds")
      return { code: "no-funds", expected: true };
    if (error.code === "fee-above-limit")
      return { code: "fee-too-high", expected: true };
  }
  // The index the chain is read through is behind it: a known state with a known remedy (wait), not something to look into.
  if (error instanceof ChainUnavailableError && error.reason === "behind")
    return { code: "index-behind", expected: true };
  return { code: "chain-unavailable", expected: false };
}
