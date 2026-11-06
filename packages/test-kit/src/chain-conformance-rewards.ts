import assert from "node:assert/strict";

import type { ChainAdapter } from "@frostbite/chain/adapter";
import type { Address, ContractRef } from "@frostbite/shared/chain";

// What an adapter that declares the rewards reader must show: a holder who has never claimed has claimed nothing, the answer is
// a whole count, asking again changes nothing, and a collectible that does not exist has no preview. The fixture names a contract, a holder with no claims and a milestone.
export interface RewardsConformanceFixtures {
  readonly contract: ContractRef;
  readonly holder: Address;
  readonly milestoneId: string;
  // A collectible that does not exist.
  readonly missingItem: ContractRef;
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
  const { contract, holder, milestoneId, missingItem } = fixtures;
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
  assert.equal(
    await reader.preview(missingItem),
    null,
    "a collectible that does not exist has no preview",
  );
}
