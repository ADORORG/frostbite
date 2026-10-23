import { describe, expect, it } from "vitest";

import {
  selectCoins,
  unconfirmedNote,
} from "../../src/bitcoin-alkanes/tx/coins.ts";
import { estimateVsize, feeFor } from "../../src/bitcoin-alkanes/tx/fees.ts";
import { idA, idB, idC, utxo } from "../support/claims.ts";

const base = {
  changeDustSats: 294n,
  fixedOutputs: ["p2wpkh"] as const,
  fixedSats: 546n,
  feeRate: 2,
  kind: "p2wpkh" as const,
  opReturnScriptLength: 51,
};

describe("the size and fee of a transaction", () => {
  it("add the fixed part, each input, each output and the call", () => {
    // 11 fixed + 68 input + 31 output + 9 framing + 51 script.
    expect(estimateVsize(["p2wpkh"], ["p2wpkh"], 51)).toBe(170);
    expect(estimateVsize(["p2wpkh", "p2tr"], ["p2wpkh", "p2tr"], 51)).toBe(
      11 + 68 + 58 + 31 + 43 + 9 + 51,
    );
  });

  it("leave out the call when there is none", () => {
    expect(estimateVsize(["p2wpkh"], ["p2tr", "p2wpkh"], null)).toBe(
      11 + 68 + 43 + 31,
    );
  });

  it("round the fee up to a whole satoshi", () => {
    expect(feeFor(170, 2)).toBe(340n);
    expect(feeFor(170, 1.1)).toBe(187n);
    expect(feeFor(100, 0.1)).toBe(10n);
    expect(feeFor(101, 1.5)).toBe(152n);
    expect(feeFor(1, 0.001)).toBe(1n);
  });
});

describe("picking coins", () => {
  it("takes the largest confirmed output that pays for the claim, and returns change", () => {
    const selection = selectCoins({
      ...base,
      utxos: [
        utxo(idA, 0, 5_000n),
        utxo(idB, 0, 100_000n),
        utxo(idC, 1, 9_000n),
      ],
    });
    expect(selection?.chosen.map(({ txid }) => txid)).toEqual([idB]);
    // Two outputs and the call: 11 + 68 + 31 + 31 + 9 + 51 = 201 vB at 2 sat/vB.
    expect(selection).toMatchObject({
      change: 100_000n - 546n - 402n,
      fee: 402n,
    });
  });

  it("adds outputs until the claim is paid for", () => {
    const selection = selectCoins({
      ...base,
      utxos: [utxo(idA, 0, 400n), utxo(idB, 0, 500n), utxo(idC, 1, 450n)],
    });
    expect(selection?.chosen.map(({ txid }) => txid)).toEqual([idB, idC, idA]);
    expect(selection?.chosen.reduce((sum, { value }) => sum + value, 0n)).toBe(
      1_350n,
    );
  });

  it("never spends an unconfirmed output", () => {
    expect(
      selectCoins({ ...base, utxos: [utxo(idA, 0, 1_000_000n, false)] }),
    ).toBeNull();
    const selection = selectCoins({
      ...base,
      utxos: [utxo(idA, 0, 1_000_000n, false), utxo(idB, 0, 10_000n)],
    });
    expect(selection?.chosen.map(({ txid }) => txid)).toEqual([idB]);
  });

  it("is null when the confirmed outputs cannot pay", () => {
    expect(selectCoins({ ...base, utxos: [] })).toBeNull();
    expect(selectCoins({ ...base, utxos: [utxo(idA, 0, 700n)] })).toBeNull();
  });

  it("pays a remainder below the dust limit as fee instead of making change", () => {
    // 546 + 340 (one output, no change: 170 vB x 2) leaves 14 spare; with change the fee is 402, so the change would be negative.
    const tight = selectCoins({ ...base, utxos: [utxo(idA, 0, 546n + 350n)] });
    expect(tight).toMatchObject({ change: 0n, fee: 350n });
    const exact = selectCoins({ ...base, utxos: [utxo(idA, 0, 546n + 340n)] });
    expect(exact).toMatchObject({ change: 0n, fee: 340n });
    expect(
      selectCoins({ ...base, utxos: [utxo(idA, 0, 546n + 339n)] }),
    ).toBeNull();
  });

  it("keeps change exactly at the dust limit", () => {
    const atDust = selectCoins({
      ...base,
      utxos: [utxo(idA, 0, 546n + 402n + 294n)],
    });
    expect(atDust).toMatchObject({ change: 294n, fee: 402n });
    const below = selectCoins({
      ...base,
      utxos: [utxo(idA, 0, 546n + 402n + 293n)],
    });
    expect(below).toMatchObject({ change: 0n, fee: 402n + 293n });
  });

  it("sorts equal values without reordering them wrongly", () => {
    const selection = selectCoins({
      ...base,
      utxos: [utxo(idA, 0, 2_000n), utxo(idB, 0, 2_000n)],
    });
    expect(selection?.chosen).toHaveLength(1);
  });
});

describe("saying why a balance is not spent", () => {
  it("names the sats still waiting for their first confirmation, and nothing when none wait", () => {
    const waiting = { ...utxo(idA, 0, 5_000_000n), confirmed: false };
    expect(unconfirmedNote([waiting, utxo(idB, 0, 1_000n)])).toContain(
      "5000000 sats",
    );
    expect(
      unconfirmedNote([waiting, { ...waiting, vout: 1, value: 7n }]),
    ).toContain("5000007 sats");
    expect(unconfirmedNote([utxo(idB, 0, 1_000n)])).toBe("");
    expect(unconfirmedNote([])).toBe("");
  });
});
