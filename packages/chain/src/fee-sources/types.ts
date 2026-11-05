import type {
  BetaNetwork,
  FeeApiFormat,
  FeeRate,
} from "@frostbite/shared/chain";

// Where the rate to pay for a confirmation target comes from. A fee source answers for the targets it is asked about, or rejects: a rate
// is never guessed and the node's own estimate is never substituted for one that could not be had.
export interface FeeSource {
  feeRates(targets: readonly number[]): Promise<readonly FeeRate[]>;
}

// Just what a fee explorer needs of `fetch` (a plain GET), so tests and other runtimes can supply their own.
export type GetLike = (
  url: string,
  init: { readonly signal: AbortSignal },
) => Promise<{
  // `unknown` is what a response body is; it is validated as JSON before anything reads it.
  readonly json: () => Promise<unknown>;
  readonly ok: boolean;
  readonly status: number;
}>;

// What a response parser is made from: where the explorer is and how to reach it.
export interface ExplorerOptions {
  readonly fetch: GetLike;
  readonly timeoutMs: number;
  // The explorer's address up to its network, without the path: `https://mempool.space/signet`.
  readonly url: string;
}

// A public explorer the platform can take fees from. It carries its own address for each network it serves, so nothing outside the
// adapter says where it is.
export interface FeeAdapter {
  readonly create: (options: ExplorerOptions) => FeeSource;
  readonly links: Readonly<Record<BetaNetwork, string>>;
  // One target for each level the explorer names, so a look at its answer reads every field the platform will later use.
  readonly probeTargets: readonly number[];
}

// A fee source as configuration states it: the adapter chosen, the network it is read for, and the rate to use when it cannot be read.
export interface FeeSourceSettings {
  readonly adapter: FeeApiFormat;
  // Used for every target when the adapter cannot be read; `null`: nothing is substituted and the failure stands.
  readonly fallbackSatPerVb: number | null;
  readonly fetch: GetLike;
  readonly network: BetaNetwork;
  // Told why each time the fallback rate was used instead of the adapter's.
  readonly onFallback?: (reason: string) => void;
  readonly timeoutMs: number;
}
