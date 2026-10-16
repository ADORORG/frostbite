import { describe, expect, it } from "vitest";

import { createRpcNode } from "../../src/bitcoin-alkanes/node/node.ts";
import { inspectContract } from "../../src/bitcoin-alkanes/inspect.ts";
import { createJsonRpc } from "../../src/bitcoin-alkanes/node/transport.ts";
import { chainFamilyIdSchema, chainRefSchema } from "@ador/shared/chain";

// Reads a real Alkanes node. Skipped unless a node URL is given (for example the public Subfrost mainnet endpoint), so the
// suite never needs the network; run it to check the decoders still match what a live node sends.
const url = process.env["ALKANES_LIVE_NODE_URL"];
const diesel = { block: 2n, tx: 0n };

describe.skipIf(url === undefined)(
  "a live Alkanes node",
  { timeout: 60_000 },
  () => {
    const node = createRpcNode(
      createJsonRpc({ fetch, timeoutMs: 30_000, url: url ?? "" }),
    );

    it("reports a block height", async () => {
      const tip = await node.tip();
      expect(tip.height).toBeGreaterThan(900_000);
      expect(tip.hash).toMatch(/^[0-9a-f]{64}$/u);
      expect(await node.indexedHeight()).toBeGreaterThan(900_000);
    });

    it("answers a view of a deployed contract", async () => {
      const name = await node.view(diesel, 99n, []);
      expect(name.ok && new TextDecoder().decode(name.data)).toBe("DIESEL");
    });

    it("reports a revert and a missing contract", async () => {
      expect((await node.view(diesel, 12345n, [])).ok).toBe(false);
      expect((await node.view({ block: 2n, tx: 987654321n }, 99n, [])).ok).toBe(
        false,
      );
      expect(await node.bytecode({ block: 2n, tx: 987654321n })).toBeNull();
    });

    it("describes transactions and the indexer's trace of one that called a contract", async () => {
      // Transaction aa9833a5…0bc2 (block 971742) called a contract at output 3; recorded 2026-10-16.
      const txid =
        "aa9833a5bc390773b721d36947409d7077ea925034b5962c677fa8bec47f0bc2";
      expect(await node.transaction(txid)).toMatchObject({
        blockHeight: 971742,
        confirmed: true,
        outputs: 2,
      });
      expect(await node.trace(txid, 3)).toBe("success");
      expect(await node.trace(txid, 0)).toBe("none");
      expect(await node.transaction("00".repeat(31) + "01")).toBeNull();
    });

    it("lists unspent outputs and a fee estimate", async () => {
      const outputs = await node.utxos(
        "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      );
      expect(Array.isArray(outputs)).toBe(true);
      expect(await node.feeRate(3)).toBeGreaterThan(0);
    });

    it("inspects the stored code", async () => {
      const ref = {
        chain: chainRefSchema.parse("bip122:000000000019d6689c085ae165831e93"),
        family: chainFamilyIdSchema.parse("bitcoin-alkanes"),
        id: "2:0",
      };
      const inspection = await inspectContract(node, ref);
      expect(inspection.exists).toBe(true);
      // SHA-256 of the 262,445 bytes of code deployed at 2:0.
      expect(inspection.codeHash).toBe(
        "f780aacd1718a312c9ac1a5f8b126a8b8e15708a4b0c908d4d633fbfdb847fd1",
      );
    });
  },
);
