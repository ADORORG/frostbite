import type { FeeApiFormat, FeeRate } from "@ador/shared/chain";

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

// What a fee explorer adapter is made from: where the explorer is and how to reach it. The format is not here; it chooses the adapter.
export interface ExplorerOptions {
  readonly fetch: GetLike;
  readonly timeoutMs: number;
  // The explorer's address up to its network, without the path: `https://mempool.space/signet`.
  readonly url: string;
}

// A fee source as configuration states it: an explorer of one format, or a rate the operator set.
export type FeeSourceSettings =
  | (ExplorerOptions & {
      readonly format: FeeApiFormat;
      readonly kind: "explorer";
    })
  | { readonly kind: "fixed"; readonly satPerVb: number };
