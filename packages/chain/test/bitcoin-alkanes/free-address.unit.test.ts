import { describe, expect, it } from "vitest";

import {
  freeTemplateAddress,
  randomBelow,
  sequenceReach,
} from "../../src/bitcoin-alkanes/admin/free-address.ts";
import { assertTransactionOptions } from "../../src/bitcoin-alkanes/options.ts";
import { options } from "../support/claims.ts";

// Ranges 10, 20, 40 wide from 1000.
const sequence = { attempts: 3, first: 1000n, window: 10n };
const code = new Uint8Array([0, 97, 115, 109]);

// A random source that gives the bytes of the next number in `values` (big-endian, as many as asked for).
function drawing(...values: number[]) {
  let next = 0;
  return (length: number) => {
    const value = BigInt(values[next] ?? values[values.length - 1] ?? 0);
    next += 1;
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      bytes[length - 1 - index] = Number((value >> BigInt(8 * index)) & 0xffn);
    }
    return bytes;
  };
}

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
  it("takes the first number drawn, in the code block, when nothing is there and nothing names it", async () => {
    const { asked, node } = nodeWithCodeAt([]);
    expect(
      await freeTemplateAddress(node, sequence, drawing(7), async () => false),
    ).toBe("4:1007");
    expect(asked).toEqual(["4:1007"]);
  });

  it("draws from a range twice as wide each time: the highest draw of each attempt is the top of its range", async () => {
    // 249, 239 and 239 are the highest values a one-byte draw can use for ranges of 10, 20 and 40.
    const { asked, node } = nodeWithCodeAt([1009n, 1019n]);
    expect(
      await freeTemplateAddress(
        node,
        sequence,
        drawing(249, 239, 239),
        async () => false,
      ),
    ).toBe("4:1039");
    expect(asked).toEqual(["4:1009", "4:1019", "4:1039"]);
  });

  it("skips an address with code on the chain, and one the platform has named, and does not look up the named one", async () => {
    const { asked, node } = nodeWithCodeAt([1003n]);
    const named = new Set(["4:1004"]);
    expect(
      await freeTemplateAddress(node, sequence, drawing(3, 4, 25), async (a) =>
        named.has(a),
      ),
    ).toBe("4:1025");
    expect(asked).toEqual(["4:1003", "4:1025"]);
  });

  it("gives up after the attempts it was allowed, without looking past them", async () => {
    const { asked, node } = nodeWithCodeAt([1001n, 1002n, 1003n]);
    expect(
      await freeTemplateAddress(
        node,
        sequence,
        drawing(1, 2, 3),
        async () => false,
      ),
    ).toBeNull();
    expect(asked).toEqual(["4:1001", "4:1002", "4:1003"]);
  });

  it("does not ask twice about a number it drew twice, but it still uses an attempt", async () => {
    const { asked, node } = nodeWithCodeAt([1003n]);
    expect(
      await freeTemplateAddress(node, sequence, drawing(3), async () => false),
    ).toBeNull();
    expect(asked).toEqual(["4:1003"]);
  });

  it("stops with the node's own error when the node cannot be asked, rather than guess", async () => {
    await expect(
      freeTemplateAddress(
        { bytecode: () => Promise.reject(new Error("the node is down")) },
        sequence,
        drawing(1),
        async () => false,
      ),
    ).rejects.toThrow("the node is down");
  });
});

describe("a number chosen at random", () => {
  it("is below the bound, and a draw that would favour small numbers is thrown away and redrawn", () => {
    const calls: number[] = [];
    const random = (length: number) => {
      calls.push(length);
      return Uint8Array.from([calls.length === 1 ? 255 : 7]);
    };
    // 255 would give 5, but 250 to 255 are the six draws that make small numbers likelier.
    expect(randomBelow(random, 10n)).toBe(7n);
    expect(calls).toEqual([1, 1]);
  });

  it("can be any number up to the bound, over as many bytes as the bound needs", () => {
    // 15,999,999 is the highest three-byte draw a bound of 1,000,000 can use; 16,000,000 is thrown away.
    expect(randomBelow(drawing(15_999_999), 1_000_000n)).toBe(999_999n);
    expect(randomBelow(drawing(5), 1_000_000n)).toBe(5n);
    expect(randomBelow(drawing(255), 1n)).toBe(0n);
  });

  it("needs a number to choose from, and a source that gives one", () => {
    expect(() => randomBelow(drawing(1), 0n)).toThrow("number to choose from");
    expect(() => randomBelow(drawing(255), 10n)).toThrow("usable number");
  });
});

describe("the template sequence setting", () => {
  it("reaches as far as its widest attempt", () => {
    expect(
      sequenceReach({ attempts: 10, first: 1_000_000n, window: 1_000_000n }),
    ).toBe(513_000_000n);
    expect(sequenceReach({ attempts: 1, first: 5n, window: 3n })).toBe(8n);
  });

  it("must start at zero or more, have a window, allow a positive whole number of attempts, and stay within an address", () => {
    expect(() => assertTransactionOptions(options)).not.toThrow();
    const top = 1n << 127n;
    for (const templateSequence of [
      { attempts: 0, first: 1000n, window: 10n },
      { attempts: 1.5, first: 1000n, window: 10n },
      { attempts: -1, first: 1000n, window: 10n },
      { attempts: 10, first: -1n, window: 10n },
      { attempts: 10, first: 1000n, window: 0n },
      { attempts: 1, first: top, window: top },
    ]) {
      expect(() =>
        assertTransactionOptions({ ...options, templateSequence }),
      ).toThrow("templateSequence");
    }
    expect(() =>
      assertTransactionOptions({
        ...options,
        templateSequence: { attempts: 1, first: top, window: top - 1n },
      }),
    ).not.toThrow();
  });
});
