import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chainFamilyIdSchema, chainRefSchema } from "@ador/shared/chain";

import { inspectContract } from "../../src/bitcoin-alkanes/inspect.ts";
import { fakeNode } from "../support/nodes.ts";

const chain = chainRefSchema.parse("bip122:000000000019d6689c085ae165831e93");
const family = chainFamilyIdSchema.parse("bitcoin-alkanes");
const nodeWith = (code: Uint8Array | null) =>
  fakeNode({ bytecode: () => Promise.resolve(code) });

describe("inspecting a contract", () => {
  it("gives the SHA-256 of the stored code", async () => {
    const code = Uint8Array.of(0, 0x61, 0x73, 0x6d);
    const ref = { chain, family, id: "2:5" };
    expect(await inspectContract(nodeWith(code), ref)).toEqual({
      codeHash: createHash("sha256").update(code).digest("hex"),
      exists: true,
      ref,
    });
  });

  it("says nothing is deployed when there is no code or the id is not an Alkane", async () => {
    const ref = { chain, family, id: "2:5" };
    expect(await inspectContract(nodeWith(null), ref)).toEqual({
      codeHash: null,
      exists: false,
      ref,
    });
    const odd = { chain, family, id: "rewards" };
    expect(await inspectContract(nodeWith(Uint8Array.of(1)), odd)).toEqual({
      codeHash: null,
      exists: false,
      ref: odd,
    });
  });
});
