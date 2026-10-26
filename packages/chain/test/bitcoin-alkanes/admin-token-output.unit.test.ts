import { Psbt } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";

import { BuildRefusedError } from "../../src/bitcoin-alkanes/build-refused.ts";
import { idA, idB, idC, utxo, walletScript } from "../support/claims.ts";
import {
  adminBuilder,
  adminNode,
  funding,
  intents,
  tokenId,
} from "../support/administration.ts";

// The staff wallet's output that holds the game's auth token is found by the platform, not typed by staff. These pin how, and what is
// said when it cannot be.
const holding = {
  alkanes: [{ amount: 1n, id: tokenId }],
  script: walletScript,
  value: 1_000n,
};
const empty = { ...holding, alkanes: [] };
// An indexer that knows the token only at the outputs named, as the real one knows only what a block put where.
const tokenAt =
  (...places: string[]) =>
  (txid: string, vout: number) =>
    Promise.resolve(
      places.includes(`${txid}:${String(vout)}`) ? holding : empty,
    );

const unnamed = { ...intents.pause, extension: {} };
const inputsOf = (payload: string) =>
  Psbt.fromBase64(payload).txInputs.map(
    (input) =>
      `${Buffer.from(input.hash).reverse().toString("hex")}:${String(input.index)}`,
  );
const refusal = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) =>
      error instanceof BuildRefusedError
        ? { code: error.code, message: error.message }
        : error,
  );
const build = (
  intent: Parameters<ReturnType<typeof adminBuilder>["build"]>[0],
  node = adminNode(),
) => adminBuilder(node).build(intent, funding);

describe("finding the output that holds the auth token", () => {
  it("finds it among the wallet's outputs when none is named, and spends it as the token", async () => {
    const node = adminNode({
      holdings: tokenAt(`${idB}:0`),
      utxos: () =>
        Promise.resolve([
          utxo(idA, 0, 1_000n),
          utxo(idB, 0, 5_000n),
          utxo(idC, 1, 100_000n),
        ]),
    });
    const { payload } = await build(unnamed, node);
    expect(inputsOf(payload)[0]).toBe(`${idB}:0`);
    // The coin that pays the fee is another output, never the token's.
    expect(inputsOf(payload).slice(1)).not.toContain(`${idB}:0`);
  });

  it("treats a blank name as none", async () => {
    const node = adminNode({ holdings: tokenAt(`${idB}:0`) });
    const { payload } = await build(
      { ...intents.pause, extension: { adminOutput: "   " } },
      node,
    );
    expect(inputsOf(payload)[0]).toBe(`${idB}:0`);
  });

  it("does not take another game's token for this one's, whether the block or the number differs", async () => {
    for (const other of [
      { block: tokenId.block + 1n, tx: tokenId.tx },
      { block: tokenId.block, tx: tokenId.tx + 1n },
    ]) {
      const node = adminNode({
        holdings: () =>
          Promise.resolve({ ...holding, alkanes: [{ amount: 1n, id: other }] }),
      });
      expect(await refusal(build(unnamed, node))).toMatchObject({
        message: expect.stringContaining(
          "None of this wallet's outputs",
        ) as string,
      });
    }
  });

  it("says so when no output of the wallet holds the token", async () => {
    const result = await refusal(
      build(unnamed, adminNode({ holdings: tokenAt() })),
    );
    expect(result).toMatchObject({
      code: "invalid-request",
      message: expect.stringContaining(
        "None of this wallet's outputs holds the game's auth token",
      ) as string,
    });
    expect(result).toMatchObject({
      message: expect.stringContaining(
        "Sign with the wallet that created the game",
      ) as string,
    });
  });

  it("says to wait when the wallet has an output still waiting for a block, since the indexer cannot see a token there", async () => {
    const node = adminNode({
      holdings: tokenAt(),
      utxos: () =>
        Promise.resolve([utxo(idA, 0, 1_000n), utxo(idB, 0, 100_000n, false)]),
    });
    expect(await refusal(build(unnamed, node))).toMatchObject({
      message: expect.stringContaining("still waiting for a block") as string,
    });
  });

  it("looks at no more than the smallest forty outputs", async () => {
    const many = Array.from({ length: 41 }, (_, index) =>
      utxo(idA, index, BigInt(1_000 + index)),
    );
    const outputs = () => Promise.resolve(many);
    // The forty-first and largest holds it: not looked at.
    expect(
      await refusal(
        build(
          unnamed,
          adminNode({ holdings: tokenAt(`${idA}:40`), utxos: outputs }),
        ),
      ),
    ).toMatchObject({ code: "invalid-request" });
    // The fortieth does.
    expect(
      inputsOf(
        (
          await build(
            unnamed,
            adminNode({ holdings: tokenAt(`${idA}:39`), utxos: outputs }),
          )
        ).payload,
      )[0],
    ).toBe(`${idA}:39`);
  });
});

describe("an output named by staff", () => {
  const named = (output: string) => ({
    ...intents.pause,
    extension: { adminOutput: output },
  });

  it("is read without the spaces around it, and refused when it is not txid:vout rather than ignored", async () => {
    expect(inputsOf((await build(named(`  ${idA}:0 `))).payload)[0]).toBe(
      `${idA}:0`,
    );
    for (const bad of ["abc", `${idA}`, `${idA}:x`, `0x${idA}:0`]) {
      expect(await refusal(build(named(bad)))).toMatchObject({
        code: "invalid-request",
        message: expect.stringContaining("txid:vout") as string,
      });
    }
  });

  it("must be one of the wallet's outputs, and says how to carry on when it is not", async () => {
    expect(await refusal(build(named(`${idC}:9`)))).toMatchObject({
      code: "invalid-request",
      message: expect.stringContaining(
        "not one of this wallet's outputs",
      ) as string,
    });
  });

  it("must be confirmed, and says to wait", async () => {
    const node = adminNode({
      utxos: () =>
        Promise.resolve([utxo(idA, 0, 1_000n, false), utxo(idB, 0, 100_000n)]),
    });
    expect(await refusal(build(named(`${idA}:0`), node))).toMatchObject({
      message: expect.stringContaining("not confirmed yet") as string,
    });
  });

  it("must hold the token, and says which token", async () => {
    expect(
      await refusal(
        build(named(`${idA}:0`), adminNode({ holdings: tokenAt() })),
      ),
    ).toMatchObject({
      message: expect.stringContaining(
        `does not hold the game's auth token ${String(tokenId.block)}:${String(tokenId.tx)}`,
      ) as string,
    });
  });

  it("is spent as the token when it is right", async () => {
    expect(inputsOf((await build(named(`${idA}:0`))).payload)[0]).toBe(
      `${idA}:0`,
    );
  });
});
