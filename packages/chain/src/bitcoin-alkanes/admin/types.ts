import type { NodeUtxo } from "../node/esplora.ts";
import type { ScriptKind } from "../tx/fees.ts";

// An output the staff's wallet owns, and what it takes to spend it.
export interface OwnedScript {
  readonly kind: ScriptKind;
  readonly script: Uint8Array;
}

// The output that holds a game's auth token (or any output being spent as such).
export interface TokenOutput extends OwnedScript {
  readonly txid: string;
  readonly value: bigint;
  readonly vout: number;
}

// What a step is paid with and where its results go.
export interface StepFunding {
  // The output holding the auth token, for a step that must present it; null for one that does not.
  readonly admin: TokenOutput | null;
  readonly changeDustSats: bigint;
  readonly feeRate: number;
  // Confirmed outputs the staff's wallet can spend to pay fees.
  readonly funder: OwnedScript & { readonly utxos: readonly NodeUtxo[] };
  // The smallest value a new output may carry.
  readonly outputDustSats: bigint;
}

export class StepRefusedError extends Error {
  readonly code = "step-refused";
  constructor(message: string) {
    super(message);
    this.name = "StepRefusedError";
  }
}
