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
      expect(await node.height()).toBeGreaterThan(900_000);
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
