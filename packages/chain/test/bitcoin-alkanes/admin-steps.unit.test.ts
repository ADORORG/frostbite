import { Psbt, Transaction } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";

import {
  createGameCall,
  defineMilestoneCall,
  pauseCall,
  publishTemplateCall,
  resumeCall,
  templateReadOnlyOpcodes,
} from "../../src/bitcoin-alkanes/admin/calls.ts";
import {
  createEnvelope,
  envelopeScript,
} from "../../src/bitcoin-alkanes/admin/envelope.ts";
import { planEnvelopeStep } from "../../src/bitcoin-alkanes/admin/envelope-step.ts";
import { newOneTimeKey } from "../../src/bitcoin-alkanes/admin/one-time-key.ts";
import { planPlainStep } from "../../src/bitcoin-alkanes/admin/plain-step.ts";
import { StepRefusedError } from "../../src/bitcoin-alkanes/admin/types.ts";
import { fromHex } from "../../src/bitcoin-alkanes/node/hex.ts";
import { callScript } from "../../src/bitcoin-alkanes/tx/call-script.ts";
import { walletScript } from "../support/claims.ts";
import {
  fixedKey,
  fundingFor,
  signRemaining,
  tokenOutput,
} from "../support/admin.ts";

const game = { block: 2n, tx: 1n };
const drawing = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>',
);

describe("the calls that administer a game", () => {
  it("name the target and carry the arguments the contract's ABI lists", () => {
    expect(defineMilestoneCall(game, 77n, 3n)).toEqual({
      inputs: [77n, 3n],
      opcode: 2n,
      target: game,
    });
    expect(pauseCall(game)).toEqual({ inputs: [], opcode: 3n, target: game });
    expect(resumeCall(game)).toEqual({ inputs: [], opcode: 4n, target: game });
    expect(createGameCall(2000n, 1000n, 4096n)).toEqual({
      inputs: [1000n, 4096n],
      opcode: 0n,
      target: { block: 6n, tx: 2000n },
    });
    expect(
      publishTemplateCall(2000n, templateReadOnlyOpcodes.gameRewards),
    ).toEqual({
      inputs: [],
      opcode: 99n,
      target: { block: 3n, tx: 2000n },
    });
  });
});

describe("a one-time key", () => {
  it("signs once, then its secret is zeroed", () => {
    const key = newOneTimeKey(() => new Uint8Array(32).fill(7));
    expect(key.publicKey).toHaveLength(33);
    expect(key.xOnly).toEqual(key.publicKey.slice(1));
    const hash = new Uint8Array(32).fill(1);
    const before = key.signSchnorr(hash);
    expect(before).toHaveLength(64);
    expect(() => key.sign()).toThrow("script-path");
    key.destroy();
    // A zero secret is not a key: signing with it fails, which proves the secret was erased.
    expect(() => key.signSchnorr(hash)).toThrow();
  });

  it("refuses a random source that gives unusable keys", () => {
    expect(() => newOneTimeKey(() => new Uint8Array(32))).toThrow("usable key");
    expect(() => newOneTimeKey(() => new Uint8Array(31).fill(7))).toThrow(
      "usable key",
    );
    expect(() => newOneTimeKey(() => new Uint8Array(32).fill(0xff))).toThrow(
      "usable key",
    );
    let calls = 0;
    const key = newOneTimeKey(() => {
      calls += 1;
      return calls === 1 ? new Uint8Array(32) : new Uint8Array(32).fill(7);
    });
    expect(calls).toBe(2);
    expect(key.publicKey).toHaveLength(33);
  });
});

describe("the envelope", () => {
  it("is a tapscript that checks the key and hides the data in an unexecuted branch", () => {
    const key = fixedKey();
    const script = envelopeScript(key.xOnly, drawing);
    expect(script[0]).toBe(0x20);
    expect([...script.slice(1, 33)]).toEqual([...key.xOnly]);
    // OP_CHECKSIG OP_FALSE OP_IF push("BIN") push("") then the data and OP_ENDIF.
    expect([...script.slice(33, 43)]).toEqual([
      0xac,
      0x00,
      0x63,
      3,
      0x42,
      0x49,
      0x4e,
      0x00,
      drawing.length,
      drawing[0],
    ]);
    expect(script[script.length - 1]).toBe(0x68);
    key.destroy();
  });

  it("splits data into pushes of at most 520 bytes and locks the commit to a taproot output", () => {
    const key = fixedKey();
    const envelope = createEnvelope(key.xOnly, new Uint8Array(1500).fill(9));
    expect(envelope.output).toHaveLength(34);
    expect([envelope.output[0], envelope.output[1]]).toEqual([0x51, 0x20]);
    expect(envelope.controlBlock).toHaveLength(33);
    expect(envelope.controlBlock[0]! & 0xfe).toBe(0xc0);
    const pushes = envelope.script.filter(
      (_byte, index) => index > 0 && envelope.script[index - 1] === 0x4d,
    );
    expect(pushes.length).toBeGreaterThanOrEqual(3);
    key.destroy();
  });
});

describe("a plain step", () => {
  const call = defineMilestoneCall(game, 77n, 3n);

  it("spends the auth token's output and a coin for the fee, and gets the token back at output 0", () => {
    const step = planPlainStep(call, fundingFor(tokenOutput));
    const psbt = step.transaction;
    expect(psbt.txInputs.map((input) => input.index)).toEqual([0, 0]);
    const [first, second, change] = psbt.txOutputs;
    expect([first?.value, [...(first?.script ?? [])]]).toEqual([
      1_000n,
      [...walletScript],
    ]);
    expect(second?.value).toBe(0n);
    // Runestone pointer 1: unallocated tokens go to the output that carries the call.
    expect([...(second?.script ?? [])]).toEqual([
      ...callScript(call, { pointer: 0, refund: 0, unallocated: 1 }),
    ]);
    expect(change?.value).toBe(100_000n - step.fee);
    expect(step.fee).toBe(
      BigInt(
        Math.ceil(
          (11 + 68 + 68 + 31 + 31 + 9 + (second?.script.length ?? 0)) * 2,
        ),
      ),
    );
  });

  it("without an auth token pays a small output to the wallet and routes nothing to the call", () => {
    const step = planPlainStep(
      createGameCall(2000n, 1000n, 4096n),
      fundingFor(null),
    );
    const [first, second] = step.transaction.txOutputs;
    expect(first?.value).toBe(546n);
    expect([...(second?.script ?? [])]).toEqual([
      ...callScript(createGameCall(2000n, 1000n, 4096n), {
        pointer: 0,
        refund: 0,
        unallocated: 0,
      }),
    ]);
    expect(step.transaction.txInputs).toHaveLength(1);
  });

  it("refuses when the wallet's confirmed balance cannot pay", () => {
    expect(() => planPlainStep(call, fundingFor(tokenOutput, 10n))).toThrow(
      StepRefusedError,
    );
  });
});

describe("an envelope step", () => {
  const call = defineMilestoneCall(game, 77n, 3n);

  it("builds a commit the wallet signs and a reveal that names the commit's output, signed on that input already", () => {
    const step = planEnvelopeStep(
      call,
      drawing,
      fundingFor(tokenOutput),
      fixedKey(),
    );
    const commitId = (() => {
      const tx = new Transaction();
      tx.version = 2;
      step.commit.txInputs.forEach((input) =>
        tx.addInput(input.hash, input.index, input.sequence),
      );
      step.commit.txOutputs.forEach((output) =>
        tx.addOutput(output.script, output.value),
      );
      return tx.getId();
    })();
    const revealFirst = step.reveal.txInputs[0];
    expect(
      Buffer.from(revealFirst?.hash ?? [])
        .reverse()
        .toString("hex"),
    ).toBe(commitId);
    expect(step.commit.txOutputs[0]?.value).toBe(step.commitSats);
    // The first input of the reveal is signed and finalized; the auth token's input is left to the staff wallet.
    expect(step.reveal.data.inputs[0]?.finalScriptWitness).toBeDefined();
    expect(step.reveal.data.inputs[1]?.finalScriptWitness).toBeUndefined();
    expect(step.reveal.data.inputs[1]?.witnessUtxo?.value).toBe(1_000n);
  });

  it("pays exactly the reveal's fee to the commit and returns everything else to the wallet", () => {
    const step = planEnvelopeStep(
      call,
      drawing,
      fundingFor(tokenOutput),
      fixedKey(),
    );
    expect(step.commitSats).toBe(step.revealFee);
    const [back, callOutput] = step.reveal.txOutputs;
    expect(back?.value).toBe(step.commitSats + 1_000n - step.revealFee);
    expect(callOutput?.value).toBe(0n);
    const change = step.commit.txOutputs[1];
    expect(change?.value).toBe(100_000n - step.commitSats - step.commitFee);
  });

  it("never underpays: the fee covers the signed size, and exceeds it only by the room a real signature may take", () => {
    const step = planEnvelopeStep(
      call,
      drawing,
      fundingFor(tokenOutput),
      fixedKey(),
    );
    const finished = signRemaining(Psbt.fromBase64(step.reveal.toBase64()));
    // The test wallet's signature is nine bytes; a real DER signature is up to 72 and the fee allows for that.
    const real = BigInt(
      Math.ceil(finished.extractTransaction().virtualSize() * 2),
    );
    expect(step.revealFee).toBeGreaterThanOrEqual(real);
    expect(step.revealFee - real).toBeLessThanOrEqual(40n);
  });

  it("tops the commit up when the token's output is below the dust limit", () => {
    const small = { ...tokenOutput, value: 100n };
    const step = planEnvelopeStep(call, drawing, fundingFor(small), fixedKey());
    expect(step.commitSats).toBe(step.revealFee + 446n);
    expect(step.reveal.txOutputs[0]?.value).toBe(546n);
  });

  it("without an auth token (publishing code) has one input, pays the output dust, and returns to the wallet", () => {
    const step = planEnvelopeStep(
      publishTemplateCall(2000n, templateReadOnlyOpcodes.gameRewards),
      new Uint8Array(3000).fill(3),
      fundingFor(null),
      fixedKey(),
    );
    expect(step.reveal.txInputs).toHaveLength(1);
    expect(step.commitSats).toBe(step.revealFee + 546n);
    expect(step.reveal.txOutputs[0]?.value).toBe(546n);
    expect([...(step.reveal.txOutputs[1]?.script ?? [])]).toEqual([
      ...callScript(publishTemplateCall(2000n, 99n), {
        pointer: 0,
        refund: 0,
        unallocated: 0,
      }),
    ]);
  });

  it("works with a taproot wallet and token output", () => {
    const taprootScript = fromHex("5120" + "ab".repeat(32));
    const funding = {
      ...fundingFor({ ...tokenOutput, kind: "p2tr", script: taprootScript }),
      funder: {
        ...fundingFor(null).funder,
        kind: "p2tr" as const,
        script: taprootScript,
      },
    };
    const step = planEnvelopeStep(call, drawing, funding, fixedKey());
    expect(step.reveal.txOutputs[0]?.script).toEqual(taprootScript);
  });

  it("destroys the one-time key even when the step cannot be built", () => {
    const key = fixedKey();
    expect(() =>
      planEnvelopeStep(call, drawing, fundingFor(tokenOutput, 10n), key),
    ).toThrow(StepRefusedError);
    expect(() => key.signSchnorr(new Uint8Array(32).fill(1))).toThrow();
  });
});
