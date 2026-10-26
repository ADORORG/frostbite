import { Psbt } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";

import {
  bundleFormat,
  decodeBundle,
} from "../../src/bitcoin-alkanes/admin/bundle.ts";
import {
  pauseCall,
  resumeCall,
} from "../../src/bitcoin-alkanes/admin/calls.ts";
import { callScript } from "../../src/bitcoin-alkanes/tx/call-script.ts";
import { sha256Hex } from "../../src/bitcoin-alkanes/admin/data.ts";
import { BuildRefusedError } from "../../src/bitcoin-alkanes/build-refused.ts";
import { createTransactionBuilder } from "../../src/bitcoin-alkanes/builder.ts";
import { psbtFormat } from "../../src/bitcoin-alkanes/format.ts";
import { family, options, utxo, idB, walletScript } from "../support/claims.ts";
import {
  adminBuilder,
  adminChains,
  adminNode,
  administration,
  funding,
  gameCode,
  intents,
  tokenId,
  collectibleTemplateAt,
  gameTemplateAt,
} from "../support/administration.ts";

const refusal = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) =>
      error instanceof BuildRefusedError ? error.code : error,
  );

describe("building the staff's steps", () => {
  it("builds a pause as one transaction that spends the auth token and shows the contract and state", async () => {
    const unsigned = await adminBuilder().build(intents.pause, funding);
    expect(unsigned.format).toBe(psbtFormat);
    const psbt = Psbt.fromBase64(unsigned.payload);
    expect(psbt.txInputs[0]?.index).toBe(0);
    expect(unsigned.summary).toMatchObject({
      contract: intents.pause.contract,
      operation: "set-claims-paused",
      paused: true,
    });
    expect(unsigned.summary.fee.baseUnits).toBeGreaterThan(0n);
  });

  it("builds a definition with a drawing as a commit and a reveal, showing the drawing's size and hash", async () => {
    const unsigned = await adminBuilder().build(intents.define, funding);
    expect(unsigned.format).toBe(bundleFormat);
    const bundle = decodeBundle(unsigned.payload);
    expect(bundle?.reveal.txInputs).toHaveLength(2);
    const bytes = new TextEncoder().encode(intents.define.drawing);
    expect(unsigned.summary).toMatchObject({
      claimLimit: 2,
      drawing: { bytes: bytes.length, sha256: sha256Hex(bytes) },
      milestone: { id: "first-frost" },
    });
  });

  it("builds a definition without a drawing as one transaction", async () => {
    const unsigned = await adminBuilder().build(
      intents.defineNoDrawing,
      funding,
    );
    expect(unsigned.format).toBe(psbtFormat);
    expect(unsigned.summary.drawing).toBeUndefined();
  });

  it("publishes a template's code, checked against its configured hash, and shows that hash", async () => {
    const unsigned = await adminBuilder().build(intents.publish, funding);
    expect(unsigned.format).toBe(bundleFormat);
    expect(unsigned.summary.template).toEqual({
      at: gameTemplateAt,
      codeHash: sha256Hex(gameCode),
      id: "game-rewards",
      version: "1.0.0",
    });
    // No auth token is spent: the reveal has one input.
    expect(decodeBundle(unsigned.payload)?.reveal.txInputs).toHaveLength(1);
  });

  it("creates a game from the configured templates without spending a token", async () => {
    const unsigned = await adminBuilder().build(intents.deploy, funding);
    expect(unsigned.format).toBe(psbtFormat);
    expect(Psbt.fromBase64(unsigned.payload).txInputs).toHaveLength(1);
    expect(unsigned.summary.template?.id).toBe("game-rewards");
    expect(unsigned.summary.template?.at).toEqual(gameTemplateAt);
    expect(unsigned.summary.collectibleAt).toEqual(collectibleTemplateAt);
    expect(unsigned.summary.maxDrawingBytes).toBe(2048);
  });

  it("makes the call from the address the step names, not from configuration", async () => {
    const callOf = async (id: string) => {
      const unsigned = await adminBuilder().build(
        { ...intents.publish, templateAt: { ...gameTemplateAt, id } },
        funding,
      );
      return decodeBundle(unsigned.payload)?.reveal.txOutputs[1]?.script;
    };
    const first = await callOf("4:2000");
    expect(first).toBeDefined();
    expect(first).not.toEqual(await callOf("4:2001"));
  });

  it("refuses what it cannot do, with a code the caller can act on", async () => {
    const build = (
      intent: Parameters<ReturnType<typeof adminBuilder>["build"]>[0],
      node = adminNode(),
    ) => refusal(adminBuilder(node).build(intent, funding));
    expect(
      await refusal(
        createTransactionBuilder(adminChains(), options, family).build(
          intents.pause,
          funding,
        ),
      ),
    ).toBe("unsupported-operation");
    expect(
      await build({ ...intents.pause, extension: { adminOutput: `${idB}:7` } }),
    ).toBe("invalid-request");
    expect(
      await build({
        ...intents.pause,
        contract: { ...intents.pause.contract, id: "x" },
      }),
    ).toBe("invalid-request");
    expect(await build({ ...intents.publish, templateVersion: "9.9.9" })).toBe(
      "invalid-request",
    );
    const missing = (key: "collectibleAt" | "maxDrawingBytes" | "templateAt") =>
      build({ ...intents.deploy, [key]: undefined });
    for (const key of [
      "collectibleAt",
      "maxDrawingBytes",
      "templateAt",
    ] as const)
      expect(await missing(key), key).toBe("invalid-request");
    expect(await build({ ...intents.publish, templateAt: undefined })).toBe(
      "invalid-request",
    );
    // Published code lives in block 4; a contract's own id is not where code can be published.
    expect(
      await build({
        ...intents.publish,
        templateAt: { ...gameTemplateAt, id: "2:5" },
      }),
    ).toBe("invalid-request");
    expect(
      await build({
        ...intents.publish,
        templateAt: { ...gameTemplateAt, id: "x" },
      }),
    ).toBe("invalid-request");
    expect(await build({ ...intents.deploy, maxDrawingBytes: 4097 })).toBe(
      "invalid-request",
    );
    expect(
      await build({ ...intents.deploy, maxDrawingBytes: 4096 }),
    ).toBeNull();
    expect(await build({ ...intents.define, drawing: "x".repeat(5000) })).toBe(
      "invalid-request",
    );
    expect(
      await build(
        intents.pause,
        adminNode({
          utxos: () =>
            Promise.resolve([utxo(`${"11".repeat(32)}`, 0, 1_000n, false)]),
        }),
      ),
    ).toBe("invalid-request");
    expect(
      await build(
        intents.pause,
        adminNode({
          holdings: () =>
            Promise.resolve({
              alkanes: [{ amount: 1n, id: { ...tokenId, tx: 1n } }],
              script: new Uint8Array(),
              value: 0n,
            }),
        }),
      ),
    ).toBe("invalid-request");
    expect(
      await build(
        intents.pause,
        adminNode({
          view: () => Promise.resolve({ error: "reverted", ok: false }),
        }),
      ),
    ).toBe("invalid-request");
    expect(
      await build(
        intents.pause,
        adminNode({
          utxos: () => Promise.resolve([utxo("11".repeat(32), 0, 1_000n)]),
        }),
      ),
    ).toBe("insufficient-funds");
    await expect(
      adminBuilder().build(intents.pause, {
        maxFee: { ...funding.maxFee, baseUnits: 1n },
      }),
    ).rejects.toMatchObject({
      code: "fee-above-limit",
      message: expect.stringMatching(
        /^The fee would be \d+ sats, above the 1 the platform allows for one step\. Choose a slower speed\.$/u,
      ) as string,
    });
  });

  it("refuses to publish code that is not the code its configuration names", async () => {
    const wrong = {
      ...administration,
      templates: new Map(
        [...administration.templates].map(([key, entry]) => [
          key,
          { ...entry, load: () => Promise.resolve(new Uint8Array(10)) },
        ]),
      ),
    };
    const builder = createTransactionBuilder(
      adminChains(),
      options,
      family,
      wrong,
    );
    expect(await refusal(builder.build(intents.publish, funding))).toBe(
      "invalid-request",
    );
  });

  it("builds a resume with the resume call, not the pause call", async () => {
    const game = { block: 2n, tx: 5n };
    const callOf = async (paused: boolean) =>
      Psbt.fromBase64(
        (await adminBuilder().build({ ...intents.pause, paused }, funding))
          .payload,
      ).txOutputs[1]?.script;
    const route = { pointer: 0, refund: 0, unallocated: 1 };
    expect(await callOf(true)).toEqual(callScript(pauseCall(game), route));
    expect(await callOf(false)).toEqual(callScript(resumeCall(game), route));
  });

  it("refuses an output that holds none of the auth token", async () => {
    const empty = adminNode({
      holdings: () =>
        Promise.resolve({
          alkanes: [{ amount: 0n, id: tokenId }],
          script: walletScript,
          value: 1_000n,
        }),
    });
    expect(
      await refusal(adminBuilder(empty).build(intents.pause, funding)),
    ).toBe("invalid-request");
  });
});
