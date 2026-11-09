import { portCapabilities, type ChainAdapter } from "@frostbite/chain/adapter";
import type {
  Broadcaster,
  ChainObserver,
  ChainReader,
  ContractGateway,
  RewardsReader,
} from "@frostbite/chain/ports";
import type {
  Amount,
  ChainRef,
  ChainTransaction,
  Observation,
  TransactionRef,
} from "@frostbite/shared/chain";

import { simulatedAddressCodec } from "./address.ts";
import {
  SimulatedLedger,
  defaultFinalityDepth,
  type ForcedBroadcast,
} from "./ledger.ts";
import {
  createSimulatedBuilder,
  decodeSimulated,
  nativeAsset,
  simulatedFamily,
  simulatedAdapterVersion,
  simulatedFee,
} from "./transaction.ts";

// How the simulated network's observation maps onto the reader's transaction status.
const transactionStatus = {
  confirmed: "confirmed",
  "not-found": "unknown",
  pending: "pending",
  reverted: "failed",
} as const satisfies Readonly<
  Record<Observation["status"], ChainTransaction["status"]>
>;

export interface SimulatedChainOptions {
  readonly chains: readonly ChainRef[];
  readonly finalityDepth?: number;
  readonly now: () => Date;
}

export interface SimulatedChainControls {
  advance(chain: ChainRef, blocks: number): void;
  // The network included this transaction and its execution failed.
  revert(ref: TransactionRef): void;
  failNext(chain: ChainRef, outcome: ForcedBroadcast): void;
  fund(chain: ChainRef, owner: string, baseUnits: bigint): void;
}

export interface SimulatedChain {
  readonly adapter: ChainAdapter;
  readonly controls: SimulatedChainControls;
}

// A deterministic second chain family (ADR-017 section 8): a different address format, a different
// finality model, and a different transaction shape from `bitcoin-alkanes`. It is a test fixture:
// `testOnly` makes the registry refuse it for any chain that is not a test chain.
export function createSimulatedChain(
  options: SimulatedChainOptions,
): SimulatedChain {
  const ledgers = new Map(
    options.chains.map((chain) => [
      chain,
      new SimulatedLedger(
        chain,
        options.now,
        options.finalityDepth ?? defaultFinalityDepth,
      ),
    ]),
  );
  const balances = new Map<string, bigint>();
  const ledger = (chain: ChainRef): SimulatedLedger => {
    const found = ledgers.get(chain);
    if (!found) throw new Error(`Chain ${chain} is not simulated here.`);
    return found;
  };

  const reader: ChainReader = {
    balances: (owner, assets) => {
      const asset = nativeAsset(owner.chain);
      const wanted = assets ?? [asset];
      const held: Amount[] = wanted
        .filter(({ chain, id }) => chain === asset.chain && id === asset.id)
        .map(() => ({
          asset,
          baseUnits: balances.get(`${owner.chain}|${owner.value}`) ?? 0n,
        }));
      return Promise.resolve(held);
    },
    head: (chain) => Promise.resolve(ledger(chain).head()),
    transaction: (ref) => {
      const { block, status } = ledger(ref.chain).observe(ref);
      return Promise.resolve({ block, ref, status: transactionStatus[status] });
    },
  };
  const contracts: ContractGateway = {
    // The simulated family has no contracts, so no address is ever in use on it; it hands out numbered ones the platform has not named.
    freeTemplateAddress: async (_chain, taken) => {
      for (let n = 1; n <= 100; n += 1) {
        const address = `template-${n}`;
        if (!(await taken(address))) return address;
      }
      return null;
    },
    // The simulated family has no contracts, so it truthfully reports none.
    inspect: (ref) => Promise.resolve({ codeHash: null, exists: false, ref }),
    simulate: (intent) => {
      if (intent.operation !== "transfer") {
        return Promise.resolve({
          fee: { asset: nativeAsset(intent.chain), baseUnits: simulatedFee },
          ok: true,
        });
      }
      const held = balances.get(`${intent.chain}|${intent.sender.value}`) ?? 0n;
      return Promise.resolve(
        held >= intent.amount.baseUnits + simulatedFee
          ? {
              fee: {
                asset: nativeAsset(intent.chain),
                baseUnits: simulatedFee,
              },
              ok: true,
            }
          : { ok: false, reason: "insufficient balance" },
      );
    },
  };
  const broadcaster: Broadcaster = {
    broadcast: (signed) =>
      Promise.resolve(
        ledgers.has(signed.chain)
          ? ledger(signed.chain).broadcast(signed.payload)
          : { kind: "rejected" as const, reason: "unknown simulated chain" },
      ),
  };
  // The simulated indexer is the ledger itself: it has read every block there is.
  const observer: ChainObserver = {
    // What an owner holds is all confirmed: the simulated ledger has no mempool to wait in.
    balance: (chain, address) =>
      Promise.resolve({
        confirmed: balances.get(`${chain}|${address}`) ?? 0n,
        pending: 0n,
      }),
    // A made-up market in which waiting less costs more: sixty satoshis per virtual byte for one block, falling as the target grows.
    feeRates: (_chain, targets) =>
      Promise.resolve(
        targets.map((target) => ({
          satPerVb: 60 / target,
          targetBlocks: target,
        })),
      ),
    indexing: (chain) => {
      const { height } = ledger(chain).head();
      return Promise.resolve({
        chain,
        indexedHeight: height,
        observedAt: new Date().toISOString(),
        tipHeight: height,
      });
    },
    observe: (ref) => Promise.resolve(ledger(ref.chain).observe(ref)),
    tip: (chain) => Promise.resolve(ledger(chain).head().height),
  };
  // The simulated contract: a claim counts once its transaction is past the finality depth and has not reverted.
  // The simulated family mints no collectibles, so it truthfully has nothing to preview.
  const rewards: RewardsReader = {
    preview: () => Promise.resolve(null),
    // The drawing the last effective definition of the milestone carried; none if it carried none.
    drawing: (contract, milestoneId) => {
      const defined = ledger(contract.chain)
        .effective()
        .map(decodeSimulated)
        .filter(
          (body) =>
            body?.operation === "define-milestone" &&
            body.contract === contract.id &&
            body.milestoneId === milestoneId,
        )
        .at(-1);
      return Promise.resolve(
        defined?.drawingBytes === undefined ||
          defined.drawingSha === undefined
          ? null
          : { bytes: defined.drawingBytes, sha256: defined.drawingSha },
      );
    },
    claimed: (contract, holder, milestoneId) =>
      Promise.resolve(
        ledger(contract.chain)
          .effective()
          .map(decodeSimulated)
          .filter(
            (body) =>
              body?.operation === "mint-milestone" &&
              body.contract === contract.id &&
              body.sender === holder.value &&
              body.milestoneId === milestoneId,
          ).length,
      ),
  };

  return {
    adapter: {
      capabilities: new Set(Object.values(portCapabilities)),
      family: simulatedFamily,
      ports: {
        addressCodec: simulatedAddressCodec,
        broadcaster,
        builder: createSimulatedBuilder(options.now),
        contracts,
        observer,
        reader,
        rewards,
      },
      supports: (chain) => ledgers.has(chain),
      testOnly: true,
      version: simulatedAdapterVersion,
    },
    controls: {
      advance: (chain, blocks) => ledger(chain).advance(blocks),
      revert: (ref) => ledger(ref.chain).revert(ref),
      failNext: (chain, outcome) => ledger(chain).failNext(outcome),
      fund: (chain, owner, baseUnits) =>
        balances.set(`${chain}|${owner}`, baseUnits),
    },
  };
}
