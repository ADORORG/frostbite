import { Psbt } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";
import { chainRefSchema, type FundingPolicy } from "@frostbite/shared/chain";

import { BuildRefusedError } from "../../src/bitcoin-alkanes/build-refused.ts";
import { createTransactionBuilder } from "../../src/bitcoin-alkanes/builder.ts";
import {
  nativeAsset,
  type ServedChain,
} from "../../src/bitcoin-alkanes/chains.ts";
import { psbtFormat } from "../../src/bitcoin-alkanes/format.ts";
import { milestoneKey } from "../../src/bitcoin-alkanes/milestone-key.ts";
import { invalidContractOrSenderWords } from "../../src/bitcoin-alkanes/refusal-words.ts";
import { claimScript } from "../../src/bitcoin-alkanes/tx/claim-call.ts";
import { fakeNode } from "../support/nodes.ts";
import {
  claimIntent,
  chain,
  family,
  fixedNow,
  game,
  idA,
  idB,
  idC,
  intent,
  options,
  utxo,
  wallet,
  walletScript,
} from "../support/claims.ts";

const funding = (sats: bigint): FundingPolicy => ({
  maxFee: { asset: nativeAsset(chain), baseUnits: sats },
});

function builderOn(utxos = [utxo(idA, 0, 100_000n)], rate = 2) {
  const asked: { feeTarget?: number; address?: string } = {};
  const node = fakeNode({
    feeRate: (target) => {
      asked.feeTarget = target;
      return Promise.resolve(rate);
    },
    utxos: (address) => {
      asked.address = address;
      return Promise.resolve(utxos);
    },
  });
  const chains = new Map<typeof chain, ServedChain>([
    [chain, { network: "mainnet", node }],
  ]);
  return { asked, builder: createTransactionBuilder(chains, options, family) };
}

describe("building a milestone claim", () => {
  it("makes a PSBT that pays the collectible to the sender, makes the call, and returns change", async () => {
    const { asked, builder } = builderOn();
    const unsigned = await builder.build(intent, funding(10_000n));
    expect(asked).toEqual({ address: wallet.value, feeTarget: 3 });
    expect(unsigned).toMatchObject({ chain, family, format: psbtFormat });
    const psbt = Psbt.fromBase64(unsigned.payload);
    expect(
      psbt.txInputs.map(({ index, sequence }) => [index, sequence]),
    ).toEqual([[0, 0xfffffffd]]);
    const [claimant, call, change] = psbt.txOutputs;
    expect([claimant?.value, [...(claimant?.script ?? [])]]).toEqual([
      546n,
      [...walletScript],
    ]);
    expect([call?.value, [...(call?.script ?? [])]]).toEqual([
      0n,
      [...claimScript({ block: 2n, tx: 5n }, milestoneKey("first-frost"))],
    ]);
    expect([change?.value, [...(change?.script ?? [])]]).toEqual([
      100_000n - 546n - 402n,
      [...walletScript],
    ]);
    expect(psbt.data.inputs[0]?.witnessUtxo?.value).toBe(100_000n);
    expect(psbt.version).toBe(2);
  });

  it("states in the summary what it built: who claims what, the fee, and when the offer ends", async () => {
    const { builder } = builderOn();
    const { summary } = await builder.build(intent, funding(10_000n));
    expect(summary).toEqual({
      chain,
      expiresAt: new Date(
        fixedNow.getTime() + options.lifetimeMs,
      ).toISOString(),
      fee: { asset: nativeAsset(chain), baseUnits: 402n },
      feeDetail: { approxMinutes: 30, satPerVb: 2, speed: "fast" },
      milestone: { contract: game, id: "first-frost" },
      operation: "mint-milestone",
      recipient: wallet,
    });
  });

  it("pays a remainder too small for change as fee, and spends several outputs when it must", async () => {
    const { builder } = builderOn([
      utxo(idA, 0, 400n),
      utxo(idB, 0, 400n),
      utxo(idC, 0, 400n),
    ]);
    const unsigned = await builder.build(intent, funding(10_000n));
    const psbt = Psbt.fromBase64(unsigned.payload);
    expect(psbt.txInputs).toHaveLength(3);
    expect(psbt.txOutputs).toHaveLength(2);
    const fee = 1_200n - 546n;
    expect(unsigned.summary.fee.baseUnits).toBe(fee);
  });

  it("refuses an operation other than a milestone claim", async () => {
    const { builder } = builderOn();
    const mint = {
      chain,
      contract: game,
      operation: "mint",
      quantity: 1n,
      sender: wallet,
    } as const;
    await expect(builder.build(mint, funding(10_000n))).rejects.toMatchObject({
      code: "unsupported-operation",
    });
  });

  it("refuses a sender or contract that does not belong to the chain", async () => {
    const { builder } = builderOn();
    const claim = (
      overrides: Partial<
        Extract<typeof intent, { operation: "mint-milestone" }>
      >,
    ) => builder.build({ ...claimIntent, ...overrides }, funding(10_000n));
    await expect(
      claim({ sender: { chain, value: "nope" } }),
    ).rejects.toMatchObject({
      code: "invalid-request",
      message: invalidContractOrSenderWords,
    });
    await expect(
      claim({ contract: { ...game, id: "rewards-1" } }),
    ).rejects.toMatchObject({
      code: "invalid-request",
      message: invalidContractOrSenderWords,
    });
    const elsewhere = chainRefSchema.parse(
      "bip122:00000000000000000000000000000009",
    );
    await expect(
      claim({
        chain: elsewhere,
        contract: { ...game, chain: elsewhere },
        sender: { chain: elsewhere, value: wallet.value },
      }),
    ).rejects.toThrow("not served");
  });

  it("refuses when the confirmed balance cannot pay, or the fee is above the limit", async () => {
    const poor = builderOn([
      utxo(idA, 0, 500n),
      utxo(idB, 0, 9_999_999n, false),
    ]);
    await expect(
      poor.builder.build(intent, funding(10_000n)),
    ).rejects.toMatchObject({
      code: "insufficient-funds",
      message: expect.stringMatching(
        /needs about \d+ sats at [\d.]+ sat\/vB, but the wallet holds 500 confirmed\./u,
      ) as string,
    });
    const { builder } = builderOn();
    await expect(builder.build(intent, funding(401n))).rejects.toMatchObject({
      code: "fee-above-limit",
      message:
        "The fee would be 402 sats, above the 401 the platform allows for one step. Choose a slower speed.",
    });
    await expect(builder.build(intent, funding(402n))).resolves.toBeDefined();
  });

  it("names its refusals", async () => {
    const error = new BuildRefusedError("invalid-request", "x");
    expect([error.name, error.code, error.message]).toEqual([
      "BuildRefusedError",
      "invalid-request",
      "x",
    ]);
  });

  it("is built with valid options", () => {
    const chains = new Map<typeof chain, ServedChain>();
    for (const bad of [
      { ...options, feeTargetBlocks: 0 },
      { ...options, lifetimeMs: 1.5 },
      { ...options, claimOutputSats: 0n },
      { ...options, changeDustSats: 0n },
      { ...options, providerId: " " },
    ]) {
      expect(() => createTransactionBuilder(chains, bad, family)).toThrow();
    }
  });
});
