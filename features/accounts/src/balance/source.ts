import type { WalletNetwork } from "@frostbite/wallet/contracts";

// Where a balance comes from: the chain indexer the platform has chosen, behind the smallest port the widget needs.
// An adapter implements it (it may wrap the chain package's address codec and `ChainReader`, which a feature may not
// import directly); it must bound its own waiting time and throw when it cannot answer. The platform has not chosen
// an indexer yet, so none is wired and the widget says so.
export interface BalanceSource {
  // Whether this is an address the source can read on that network. Nothing is looked up for one it refuses.
  accepts(address: string, network: WalletNetwork): boolean;
  // What the address holds, in satoshis: `confirmedSats` is spendable, `pendingSats` is still waiting for its first confirmation.
  balance(address: string, network: WalletNetwork): Promise<AddressHoldings>;
}

export interface AddressHoldings {
  readonly confirmedSats: number;
  readonly pendingSats: number;
}
