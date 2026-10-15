// Where a balance comes from: the chain indexer the platform has chosen, behind the smallest port the widget needs.
// An adapter implements it (it may wrap the chain package's `ChainReader`); it must bound its own waiting time and
// throw when it cannot answer. The platform has not chosen an indexer yet, so none is wired and the widget says so.
export interface BalanceSource {
  // The confirmed bitcoin balance of an address, in satoshis.
  satoshis(address: string, network: "mainnet" | "signet"): Promise<number>;
}
