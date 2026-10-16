import type { NodeUtxo } from "../node/esplora.ts";
import { estimateVsize, feeFor, type ScriptKind } from "./fees.ts";

export interface CoinSelection {
  // Left over for the sender, or 0n when it would be dust and goes to the fee instead.
  readonly change: bigint;
  readonly chosen: readonly NodeUtxo[];
  readonly fee: bigint;
}

export interface CoinRequest {
  // Below this a change output is not worth making; the remainder is paid as fee.
  readonly changeDustSats: bigint;
  // Inputs the transaction already has (for example the output that holds an auth token), which add to its size.
  readonly existingInputs?: readonly ScriptKind[];
  readonly feeRate: number;
  // What the outputs that must be paid carry (for a claim, the claimant's output, which must be above the dust limit so the
  // collectible has somewhere to land), and their script kinds. Change, if any, is added to these.
  readonly fixedOutputs: readonly ScriptKind[];
  readonly fixedSats: bigint;
  // The kind of script the coins being spent, and the change, are locked to.
  readonly kind: ScriptKind;
  readonly opReturnScriptLength: number | null;
  readonly utxos: readonly NodeUtxo[];
}

// Picks the fewest, largest confirmed outputs that pay for the fixed outputs and the fee. Unconfirmed outputs are never spent: a
// claim built on one would fail if that transaction were replaced.
export function selectCoins(request: CoinRequest): CoinSelection | null {
  const candidates = request.utxos
    .filter((utxo) => utxo.confirmed)
    .sort((a, b) => (a.value === b.value ? 0 : a.value > b.value ? -1 : 1));
  const chosen: NodeUtxo[] = [];
  let total = 0n;
  for (const utxo of candidates) {
    chosen.push(utxo);
    total += utxo.value;
    const kinds = [
      ...(request.existingInputs ?? []),
      ...chosen.map(() => request.kind),
    ];
    const without = feeFor(
      estimateVsize(kinds, request.fixedOutputs, request.opReturnScriptLength),
      request.feeRate,
    );
    if (total < request.fixedSats + without) continue;
    const withChange = feeFor(
      estimateVsize(
        kinds,
        [...request.fixedOutputs, request.kind],
        request.opReturnScriptLength,
      ),
      request.feeRate,
    );
    const change = total - request.fixedSats - withChange;
    return change >= request.changeDustSats
      ? { change, chosen, fee: withChange }
      : { change: 0n, chosen, fee: total - request.fixedSats };
  }
  return null;
}
