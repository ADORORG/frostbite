import { beforeEach, describe, expect, it, vi } from "vitest";

const chain = vi.hoisted(() => ({
  walletRequests: vi.fn(),
  withWalletSignatures: vi.fn(),
}));
vi.mock("@ador/chain/wallet-signing", () => chain);

import {
  signWithWallet,
  WalletRefusedError,
  walletRefusedCopy,
  type StepTransaction,
} from "../src/bridge/step-signer.ts";

const transaction: StepTransaction = {
  chain: "bip122:signet",
  family: "bitcoin-alkanes",
  format: "bitcoin-psbt-bundle",
  payload: "built",
};

beforeEach(() => {
  chain.walletRequests.mockReset();
  chain.withWalletSignatures.mockReset();
});

describe("having the connected wallet sign a built transaction", () => {
  it("asks for each PSBT in order, one at a time, with only the inputs to sign, and puts the answers back", async () => {
    chain.walletRequests.mockReturnValue([
      { inputs: [0, 1], psbt: "commit" },
      { inputs: [1], psbt: "reveal" },
    ]);
    chain.withWalletSignatures.mockReturnValue("signed");
    const order: string[] = [];
    const wallet = {
      signPsbt: vi.fn(async (psbt: string) => {
        order.push(`start ${psbt}`);
        await Promise.resolve();
        order.push(`end ${psbt}`);
        return `signed ${psbt}`;
      }),
    };
    expect(await signWithWallet(wallet, transaction)).toEqual({
      ...transaction,
      payload: "signed",
    });
    expect(wallet.signPsbt.mock.calls).toEqual([
      ["commit", [0, 1]],
      ["reveal", [1]],
    ]);
    // The wallet is never shown two approvals at once.
    expect(order).toEqual([
      "start commit",
      "end commit",
      "start reveal",
      "end reveal",
    ]);
    expect(chain.walletRequests).toHaveBeenCalledWith(
      transaction.format,
      transaction.payload,
    );
    expect(chain.withWalletSignatures).toHaveBeenCalledWith(
      transaction.format,
      transaction.payload,
      ["signed commit", "signed reveal"],
    );
  });

  it("signs nothing for a family it has no mapping for, or a format it does not know", async () => {
    const wallet = { signPsbt: vi.fn() };
    expect(
      await signWithWallet(wallet, { ...transaction, family: "simulated" }),
    ).toBeNull();
    expect(chain.walletRequests).not.toHaveBeenCalled();
    chain.walletRequests.mockReturnValue(null);
    expect(await signWithWallet(wallet, transaction)).toBeNull();
    expect(wallet.signPsbt).not.toHaveBeenCalled();
  });

  it("does not ask the wallet when there is nothing left to sign", async () => {
    chain.walletRequests.mockReturnValue([]);
    chain.withWalletSignatures.mockReturnValue("same");
    const wallet = { signPsbt: vi.fn() };
    expect(await signWithWallet(wallet, transaction)).toMatchObject({
      payload: "same",
    });
    expect(wallet.signPsbt).not.toHaveBeenCalled();
  });

  it("lets a refusal by the wallet through, and refuses answers that do not fit the request", async () => {
    chain.walletRequests.mockReturnValue([{ inputs: [0], psbt: "commit" }]);
    await expect(
      signWithWallet(
        { signPsbt: vi.fn().mockRejectedValue(new Error("User declined")) },
        transaction,
      ),
    ).rejects.toThrow("User declined");
    chain.withWalletSignatures.mockReturnValue(null);
    await expect(
      signWithWallet({ signPsbt: vi.fn(async () => "x") }, transaction),
    ).rejects.toBeInstanceOf(WalletRefusedError);
  });
});

describe("what is said when the wallet gave nothing signed", () => {
  it("says the wallet's own words after the plain fact, cut to a length that fits, and the plain fact alone when it gave none", () => {
    expect(walletRefusedCopy(new Error("User rejected the request"))).toBe(
      "Your wallet did not give back a signed transaction, so nothing was sent. Reason: User rejected the request",
    );
    expect(walletRefusedCopy(new Error("x".repeat(400)))).toBe(
      `Your wallet did not give back a signed transaction, so nothing was sent. Reason: ${"x".repeat(300)}`,
    );
    expect(walletRefusedCopy(new Error("  "))).toBe(
      "Your wallet did not sign, so nothing was sent.",
    );
    expect(walletRefusedCopy("declined")).toBe(
      "Your wallet did not sign, so nothing was sent.",
    );
  });
});
