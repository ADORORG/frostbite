import { validateBitcoinAddress } from "@ador/chain/bitcoin";
import type { BalanceSource } from "@ador/feature-accounts";

import { betaChain } from "./chains.ts";
import { followedRewardsChain } from "./game-rewards.ts";

// Where the header's balance comes from: the rewards chain's own node, for an address on the network this deployment runs the beta on.
// A wallet on another network, an address that is not valid there, or no chain configured is not looked up, and the widget says there
// is no balance. Satoshis are held as a number here because no balance can exceed 2.1e15 (the operation refuses one that does).
const followed = followedRewardsChain;

export const balanceSource: BalanceSource | null =
  followed === null
    ? null
    : {
        accepts: (address, network) =>
          network === betaChain.network &&
          validateBitcoinAddress(address, network).ok,
        balance: async (address) => {
          const held = await followed.balance(address);
          return {
            confirmedSats: Number(held.confirmed),
            pendingSats: Number(held.pending),
          };
        },
      };
