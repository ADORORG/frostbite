import { Psbt } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";
import type {
  FundingPolicy,
  TransactionIntent,
  UnsignedTransaction,
} from "@frostbite/shared/chain";

import { validateBitcoinAddress } from "../../src/bitcoin/address.ts";
import { BuildRefusedError } from "../../src/bitcoin-alkanes/build-refused.ts";
import { createTransactionBuilder } from "../../src/bitcoin-alkanes/builder.ts";
import {
  nativeAsset,
  type ServedChain,
} from "../../src/bitcoin-alkanes/chains.ts";
import { fromHex } from "../../src/bitcoin-alkanes/node/hex.ts";
import { fakeNode } from "../support/nodes.ts";
import {
  chain,
  claimIntent,
  family,
  idA,
  options,
  sign,
  utxo,
  wallet,
  walletScript,
} from "../support/claims.ts";

// A P2TR address on mainnet, standing in for the platform's treasury.
const treasury = {
  chain,
  value: "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0",
};
const treasuryScript = (() => {
  const checked = validateBitcoinAddress(treasury.value, "mainnet");
  if (!checked.ok) throw new Error("the test address is not valid");
  return fromHex(checked.value.scriptHex);
})();
const fee = (sats: bigint) => ({
  amount: { asset: nativeAsset(chain), baseUnits: sats },
  recipient: treasury,
});
const withFee = (sats: bigint): TransactionIntent => ({
  ...claimIntent,
  platformFee: { baseUnits: sats, recipient: treasury },
});
const funding: FundingPolicy = {
  maxFee: { asset: nativeAsset(chain), baseUnits: 10_000n },
};

function builderOn(balance: bigint) {
  const chains = new Map<typeof chain, ServedChain>([
    [
      chain,
      {
        network: "mainnet",
        node: fakeNode({
          feeRate: () => Promise.resolve(2),
          utxos: () => Promise.resolve([utxo(idA, 0, balance)]),
        }),
      },
    ],
  ]);
  return createTransactionBuilder(chains, options, family);
}
const bytes = (script: Uint8Array | undefined) => [...(script ?? [])];

describe("a milestone claim that carries the platform's fee", () => {
  it("pays the fee to the treasury as the third output, after the claimant and the call, and change last", async () => {
    const unsigned = await builderOn(100_000n).build(withFee(1_000n), funding);
    const outputs = Psbt.fromBase64(unsigned.payload).txOutputs;
    expect(outputs).toHaveLength(4);
    expect([outputs[0]?.value, bytes(outputs[0]?.script)]).toEqual([
      546n,
      bytes(walletScript),
    ]);
    expect(outputs[1]?.value).toBe(0n);
    expect([outputs[2]?.value, bytes(outputs[2]?.script)]).toEqual([
      1_000n,
      bytes(treasuryScript),
    ]);
    expect(bytes(outputs[3]?.script)).toEqual(bytes(walletScript));
  });

  it("keeps the network fee apart from the platform's: the inputs pay for both and the change is what is left", async () => {
    const unsigned = await builderOn(100_000n).build(withFee(1_000n), funding);
    const outputs = Psbt.fromBase64(unsigned.payload).txOutputs;
    const networkFee = unsigned.summary.fee.baseUnits;
    expect(unsigned.summary.platformFee).toEqual(fee(1_000n));
    expect(outputs[3]?.value).toBe(100_000n - 546n - 1_000n - networkFee);
    // Paying one more output costs more network fee than the same claim without it.
    const plain = await builderOn(100_000n).build(claimIntent, funding);
    expect(networkFee).toBeGreaterThan(plain.summary.fee.baseUnits);
    expect(plain.summary.platformFee).toBeUndefined();
  });

  it("counts the fee when choosing what to spend: a balance that covers the claim alone does not cover it with the fee", async () => {
    await expect(
      builderOn(1_000n).build(claimIntent, funding),
    ).resolves.toBeDefined();
    await expect(
      builderOn(1_000n).build(withFee(600n), funding),
    ).rejects.toMatchObject({ code: "insufficient-funds" });
  });

  it("refuses a fee under the dust limit of the treasury's address, and takes exactly the limit", async () => {
    const builder = builderOn(100_000n);
    await expect(builder.build(withFee(329n), funding)).rejects.toBeInstanceOf(
      BuildRefusedError,
    );
    await expect(builder.build(withFee(330n), funding)).resolves.toBeDefined();
  });

  it("refuses a treasury address that is not an address on this network", async () => {
    const testnet = {
      chain,
      value: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    };
    await expect(
      builderOn(100_000n).build(
        {
          ...claimIntent,
          platformFee: { baseUnits: 1_000n, recipient: testnet },
        },
        funding,
      ),
    ).rejects.toMatchObject({ code: "invalid-request" });
  });
});

describe("checking what the wallet signed against a fee that was shown", () => {
  const build = () => builderOn(100_000n).build(withFee(1_000n), funding);
  const verify = (unsigned: UnsignedTransaction) =>
    builderOn(100_000n).verifySigned(unsigned, sign(unsigned));
  const reshown = (
    unsigned: UnsignedTransaction,
    summary: Partial<UnsignedTransaction["summary"]>,
  ): UnsignedTransaction => ({
    ...unsigned,
    summary: { ...unsigned.summary, ...summary },
  });

  it("accepts the transaction as built", async () => {
    expect(verify(await build())).toEqual({ ok: true });
  });

  it("refuses when the fee shown is not the fee paid", async () => {
    const unsigned = await build();
    expect(verify(reshown(unsigned, { platformFee: fee(999n) }))).toMatchObject(
      { ok: false, reason: "summary-mismatch" },
    );
  });

  it("refuses when the fee goes to someone else than the address shown", async () => {
    const unsigned = await build();
    expect(
      verify(
        reshown(unsigned, {
          platformFee: { ...fee(1_000n), recipient: wallet },
        }),
      ),
    ).toMatchObject({ ok: false, reason: "summary-mismatch" });
  });

  it("refuses a transaction that pays a fee the summary does not show", async () => {
    const unsigned = await build();
    expect(verify(reshown(unsigned, { platformFee: undefined }))).toMatchObject(
      { ok: false, reason: "summary-mismatch" },
    );
  });

  it("refuses a summary that shows a fee the transaction does not pay", async () => {
    const plain = await builderOn(100_000n).build(claimIntent, funding);
    expect(verify(reshown(plain, { platformFee: fee(1_000n) }))).toMatchObject({
      ok: false,
      reason: "summary-mismatch",
    });
  });

  it("refuses a returned transaction whose fee output was changed", async () => {
    const unsigned = await build();
    const built = Psbt.fromBase64(unsigned.payload);
    // The same transaction, but paying the treasury one satoshi.
    const changed = new Psbt();
    changed.setVersion(built.version);
    built.txInputs.forEach((input, index) =>
      changed.addInput({
        hash: input.hash,
        index: input.index,
        sequence: input.sequence,
        witnessUtxo: built.data.inputs[index]?.witnessUtxo,
      }),
    );
    built.txOutputs.forEach((output, index) =>
      changed.addOutput({
        script: output.script,
        value: index === 2 ? 1n : output.value,
      }),
    );
    expect(
      builderOn(100_000n).verifySigned(
        unsigned,
        sign({ ...unsigned, payload: changed.toBase64() }),
      ),
    ).toMatchObject({ ok: false, reason: "payload-mismatch" });
  });
});
