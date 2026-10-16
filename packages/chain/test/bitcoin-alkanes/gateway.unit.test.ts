import { Transaction } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";
import { chainRefSchema } from "@ador/shared/chain";

import { gameRewardsOpcodes } from "../../src/bitcoin-alkanes/abi.ts";
import {
  nativeAsset,
  type ServedChain,
} from "../../src/bitcoin-alkanes/chains.ts";
import { createContractGateway } from "../../src/bitcoin-alkanes/contracts.ts";
import { milestoneKey } from "../../src/bitcoin-alkanes/milestone-key.ts";
import type { ViewResult } from "../../src/bitcoin-alkanes/node/messages.ts";
import type { AlkanesNode } from "../../src/bitcoin-alkanes/node/node.ts";
import { claimScript } from "../../src/bitcoin-alkanes/tx/claim-call.ts";
import { fakeNode } from "../support/nodes.ts";
import {
  chain,
  claimIntent,
  game,
  options,
  wallet,
  walletScript,
} from "../support/claims.ts";

interface Seen {
  readonly inputs: readonly bigint[];
  readonly opcode: bigint;
  readonly target: { block: bigint; tx: bigint };
  readonly transaction: Uint8Array | undefined;
}

function gateway(answer: ViewResult, bytecode: Uint8Array | null = null) {
  const seen: Seen[] = [];
  const node: AlkanesNode = fakeNode({
    bytecode: () => Promise.resolve(bytecode),
    feeRate: () => Promise.resolve(2),
    view: (target, opcode, inputs, transaction) => {
      seen.push({ inputs, opcode, target, transaction });
      return Promise.resolve(answer);
    },
  });
  const chains = new Map<typeof chain, ServedChain>([
    [chain, { network: "mainnet", node }],
  ]);
  return { gateway: createContractGateway(chains, options), seen };
}

const success: ViewResult = { data: new Uint8Array(), fuelUsed: 1n, ok: true };

describe("simulating a claim", () => {
  it("runs the claim at the game inside a transaction that pays the sender at output 0", async () => {
    const { gateway: contracts, seen } = gateway(success);
    const result = await contracts.simulate(claimIntent);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      inputs: [milestoneKey("first-frost")],
      opcode: gameRewardsOpcodes.claim,
      target: { block: 2n, tx: 5n },
    });
    const transaction = Transaction.fromBuffer(
      seen[0]?.transaction ?? new Uint8Array(),
    );
    expect(transaction.outs).toHaveLength(1);
    expect([...(transaction.outs[0]?.script ?? [])]).toEqual([...walletScript]);
    // One input, the claimant output, the call and change, at 2 sat/vB: 11 + 68 + 31 + 31 + 9 + 51 = 201 vB.
    expect(result).toEqual({
      fee: { asset: nativeAsset(chain), baseUnits: 402n },
      ok: true,
    });
    expect(
      claimScript({ block: 2n, tx: 5n }, milestoneKey("first-frost")).length,
    ).toBe(51);
  });

  it("tells the contract's own reason when it would refuse", async () => {
    const { gateway: contracts } = gateway({
      error: "ALKANES: revert: Error: claim limit reached",
      ok: false,
    });
    expect(await contracts.simulate(claimIntent)).toEqual({
      ok: false,
      reason: "claim limit reached",
    });
    const plain = gateway({
      error: "unexpected end-of-file (at offset 0x0)",
      ok: false,
    });
    expect(await plain.gateway.simulate(claimIntent)).toEqual({
      ok: false,
      reason: "unexpected end-of-file (at offset 0x0)",
    });
    const empty = gateway({ error: "Error: ", ok: false });
    expect(await empty.gateway.simulate(claimIntent)).toEqual({
      ok: false,
      reason: "The contract refused the claim.",
    });
  });

  it("refuses without asking the node when the sender or contract is not valid for the chain", async () => {
    const { gateway: contracts, seen } = gateway(success);
    expect(
      await contracts.simulate({
        ...claimIntent,
        sender: { chain, value: "nope" },
      }),
    ).toMatchObject({ ok: false });
    expect(
      await contracts.simulate({
        ...claimIntent,
        contract: { ...game, id: "rewards" },
      }),
    ).toMatchObject({ ok: false });
    expect(seen).toHaveLength(0);
  });

  it("simulates milestone claims only", async () => {
    const { gateway: contracts } = gateway(success);
    const mint = {
      chain,
      contract: game,
      operation: "mint",
      quantity: 1n,
      sender: wallet,
    } as const;
    expect(await contracts.simulate(mint)).toEqual({
      ok: false,
      reason:
        "The bitcoin-alkanes adapter simulates milestone claims only, not mint.",
    });
  });

  it("refuses a chain it does not serve", async () => {
    const { gateway: contracts } = gateway(success);
    const elsewhere = chainRefSchema.parse(
      "bip122:00000000000000000000000000000009",
    );
    await expect(
      contracts.simulate({
        ...claimIntent,
        chain: elsewhere,
        contract: { ...game, chain: elsewhere },
        sender: { chain: elsewhere, value: wallet.value },
      }),
    ).rejects.toThrow("not served");
  });
});

describe("inspecting a contract", () => {
  it("reports the stored code's hash, or that nothing is deployed", async () => {
    const present = gateway(success, Uint8Array.of(0, 0x61, 0x73, 0x6d));
    expect(await present.gateway.inspect(game)).toMatchObject({
      exists: true,
      ref: game,
    });
    expect(await gateway(success).gateway.inspect(game)).toEqual({
      codeHash: null,
      exists: false,
      ref: game,
    });
  });
});
