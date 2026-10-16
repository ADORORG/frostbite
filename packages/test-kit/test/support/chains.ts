import { chainRefSchema, type TransactionIntent } from "@ador/shared/chain";

import type {
  ChainConformanceFixtures,
  RewardsConformanceFixtures,
} from "../../src/chain-conformance.ts";
import { simulatedAddress } from "../../src/simulated-chain/address.ts";
import { createSimulatedChain } from "../../src/simulated-chain/adapter.ts";
import {
  nativeAsset,
  signSimulated,
  simulatedFamily,
} from "../../src/simulated-chain/transaction.ts";

export const one = chainRefSchema.parse("simnet:one");
export const two = chainRefSchema.parse("simnet:two");
export const three = chainRefSchema.parse("simnet:three");

export const funding = {
  maxFee: { asset: nativeAsset(one), baseUnits: 10n },
};

export const fixedNow = new Date("2026-10-09T12:00:00.000Z");

export function simulated() {
  const chain = createSimulatedChain({
    chains: [one, two],
    now: () => fixedNow,
  });
  const sender = simulatedAddress(one, "a1b2c3");
  const recipient = simulatedAddress(one, "d4e5f6");
  chain.controls.fund(one, sender.value, 100n);
  const intent: TransactionIntent = {
    amount: { asset: nativeAsset(one), baseUnits: 5n },
    chain: one,
    operation: "transfer",
    recipient,
    sender,
  };
  const fixtures: ChainConformanceFixtures = {
    address: {
      canonical: sender.value,
      invalid: [
        "",
        "sim:one:abcdef00",
        "sim:one:ABCDEF12",
        ` ${sender.value}`,
        "sim:one:abc",
      ],
    },
    chain: one,
    crossChain: [simulatedAddress(two, "a1b2c3").value],
    transaction: {
      funding,
      intent,
      now: () => fixedNow,
      sign: signSimulated,
      tamper: (signed) => ({ ...signed, payload: `x${signed.payload}` }),
    },
    unservedChain: three,
  };
  // A claim from a rewards contract on the same chain, by the same wallet.
  const contract = { chain: one, family: simulatedFamily, id: "rewards-1" };
  const claimIntent: TransactionIntent = {
    chain: one,
    contract,
    milestoneId: "first-win",
    operation: "mint-milestone",
    sender,
  };
  const claimFixtures: ChainConformanceFixtures = {
    ...fixtures,
    transaction: {
      funding,
      intent: claimIntent,
      now: () => fixedNow,
      sign: signSimulated,
      tamper: (signed) => ({ ...signed, payload: `x${signed.payload}` }),
    },
  };
  const rewards: RewardsConformanceFixtures = {
    contract,
    holder: simulatedAddress(one, "070809"),
    milestoneId: "first-win",
    missingItem: { ...contract, id: "missing-item" },
  };
  return {
    ...chain,
    claimFixtures,
    claimIntent,
    contract,
    fixtures,
    intent,
    recipient,
    rewards,
    sender,
  };
}

// The simulated adapter with each port resolved, so a test fails loudly if one is missing.
export function simulatedPorts() {
  const chain = simulated();
  const need = <Name extends keyof typeof chain.adapter.ports>(name: Name) => {
    const found = chain.adapter.ports[name];
    if (!found) throw new Error(`missing ${name}`);
    return found;
  };
  return { ...chain, need };
}
