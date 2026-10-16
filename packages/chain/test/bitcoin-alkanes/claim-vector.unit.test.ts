import { Psbt } from "bitcoinjs-lib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createTransactionBuilder } from "../../src/bitcoin-alkanes/builder.ts";
import {
  nativeAsset,
  type ServedChain,
} from "../../src/bitcoin-alkanes/chains.ts";
import { toHex } from "../../src/bitcoin-alkanes/node/hex.ts";
import { fakeNode } from "../support/nodes.ts";
import {
  chain,
  claimIntent,
  family,
  options,
  sign,
} from "../support/claims.ts";

// The transaction the indexer harness sends to a real Alkanes indexer (`contracts/templates/harness/tests/typescript_claim.rs`).
// If the builder changes what it builds, this fails until the vector is rewritten and the harness run on the new bytes.
const vector = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../../contracts/templates/abi/claim-transaction-vector.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as {
  readonly claimantScript: string;
  readonly game: string;
  readonly milestone: string;
  readonly txHex: string;
  readonly txid: string;
};

describe("the claim transaction the indexer harness accepts", () => {
  it("is exactly what the builder produces for the same wallet, coins, fee rate and milestone", async () => {
    const node = fakeNode({
      feeRate: () => Promise.resolve(2),
      utxos: () =>
        Promise.resolve([
          { confirmed: true, txid: "11".repeat(32), value: 100_000n, vout: 0 },
        ]),
    });
    const chains = new Map<typeof chain, ServedChain>([
      [chain, { network: "mainnet", node }],
    ]);
    const unsigned = await createTransactionBuilder(
      chains,
      options,
      family,
    ).build(
      {
        ...claimIntent,
        contract: { ...claimIntent.contract, id: vector.game },
        milestoneId: vector.milestone,
      },
      { maxFee: { asset: nativeAsset(chain), baseUnits: 10_000n } },
    );
    const transaction = Psbt.fromBase64(
      sign(unsigned).payload,
    ).extractTransaction();
    expect(transaction.toHex()).toBe(vector.txHex);
    expect(transaction.getId()).toBe(vector.txid);
    expect(toHex(transaction.outs[0]?.script ?? new Uint8Array())).toBe(
      vector.claimantScript,
    );
  });
});
