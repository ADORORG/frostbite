import assert from "node:assert/strict";

import type { ChainAdapter } from "@ador/chain/adapter";
import type { Address, ContractRef } from "@ador/shared/chain";

// What an adapter that declares the rewards reader must show: a holder who has never claimed has claimed nothing, the answer is
// a whole count, and asking again changes nothing. The fixture names a contract, a holder with no claims and a milestone.
export interface RewardsConformanceFixtures {
  readonly contract: ContractRef;
  readonly holder: Address;
  readonly milestoneId: string;
}

export async function checkRewardsReader(
  adapter: ChainAdapter,
  fixtures: RewardsConformanceFixtures,
): Promise<void> {
  const reader = adapter.ports.rewards;
  assert.ok(
    reader,
    "the adapter declares rewards:read but does not provide it",
  );
  const { contract, holder, milestoneId } = fixtures;
  const first = await reader.claimed(contract, holder, milestoneId);
  assert.ok(
    Number.isInteger(first) && first >= 0,
    "the count is a non-negative whole number",
  );
  assert.equal(first, 0, "a holder who never claimed has claimed nothing");
  assert.equal(
    await reader.claimed(contract, holder, milestoneId),
    first,
    "asking again returns the same count",
  );
}
