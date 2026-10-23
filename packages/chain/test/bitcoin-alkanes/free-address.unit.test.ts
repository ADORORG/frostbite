import { describe, expect, it } from "vitest";

import { freeTemplateAddress } from "../../src/bitcoin-alkanes/admin/free-address.ts";
import { assertTransactionOptions } from "../../src/bitcoin-alkanes/options.ts";
import { options } from "../support/claims.ts";

const sequence = { attempts: 5, first: 1000n };
const code = new Uint8Array([0, 97, 115, 109]);

// A node with code at some `{4, n}` and nothing elsewhere, remembering which ids it was asked about.
function nodeWithCodeAt(taken: readonly bigint[]) {
  const asked: string[] = [];
  return {
    asked,
    node: {
      bytecode: (id: { block: bigint; tx: bigint }) => {
        asked.push(`${id.block}:${id.tx}`);
        return Promise.resolve(
          id.block === 4n && taken.includes(id.tx) ? code : null,
        );
      },
    },
  };
}

describe("choosing where a template goes", () => {
  it("takes the first number in the code block, when nothing is there and nothing names it", async () => {
    const { asked, node } = nodeWithCodeAt([]);
    expect(await freeTemplateAddress(node, sequence, async () => false)).toBe(
      "4:1000",
    );
    expect(asked).toEqual(["4:1000"]);
  });

  it("skips an address with code on the chain, and one the platform has named, in order", async () => {
    const { asked, node } = nodeWithCodeAt([1000n, 1002n]);
    const named = new Set(["4:1001"]);
    expect(
      await freeTemplateAddress(node, sequence, async (a) => named.has(a)),
    ).toBe("4:1003");
    // An address the platform has named is not looked up on the chain.
    expect(asked).toEqual(["4:1000", "4:1002", "4:1003"]);
  });

  it("gives up after the attempts it was allowed, without looking past them", async () => {
    const { asked, node } = nodeWithCodeAt([1000n, 1001n, 1002n, 1003n, 1004n]);
    expect(
      await freeTemplateAddress(node, sequence, async () => false),
    ).toBeNull();
    expect(asked).toHaveLength(5);
    expect(asked).not.toContain("4:1005");
  });

  it("stops with the node's own error when the node cannot be asked, rather than guess", async () => {
    await expect(
      freeTemplateAddress(
        { bytecode: () => Promise.reject(new Error("the node is down")) },
        sequence,
        async () => false,
      ),
    ).rejects.toThrow("the node is down");
  });
});

describe("the template sequence setting", () => {
  it("must start at zero or more and allow a positive whole number of attempts", () => {
    expect(() => assertTransactionOptions(options)).not.toThrow();
    for (const templateSequence of [
      { attempts: 0, first: 1000n },
      { attempts: 1.5, first: 1000n },
      { attempts: -1, first: 1000n },
      { attempts: 10, first: -1n },
    ]) {
      expect(() =>
        assertTransactionOptions({ ...options, templateSequence }),
      ).toThrow("templateSequence");
    }
  });
});
