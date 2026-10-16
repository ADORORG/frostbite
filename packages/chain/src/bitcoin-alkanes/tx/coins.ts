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
  // What the claim output (output 0) carries: it must be above the dust limit so the collectible has somewhere to land.
  readonly claimOutputSats: bigint;
  readonly feeRate: number;
  readonly kind: ScriptKind;
  readonly opReturnScriptLength: number;
  readonly utxos: readonly NodeUtxo[];
}

// Picks the fewest, largest confirmed outputs that pay for the claim output and the fee. Unconfirmed outputs are never spent: a
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
    const kinds = chosen.map(() => request.kind);
    const without = feeFor(
      estimateVsize(kinds, [request.kind], request.opReturnScriptLength),
      request.feeRate,
    );
    if (total < request.claimOutputSats + without) continue;
    const withChange = feeFor(
      estimateVsize(
        kinds,
        [request.kind, request.kind],
        request.opReturnScriptLength,
      ),
      request.feeRate,
    );
    const change = total - request.claimOutputSats - withChange;
    return change >= request.changeDustSats
      ? { change, chosen, fee: withChange }
      : { change: 0n, chosen, fee: total - request.claimOutputSats };
  }
  return null;
}
