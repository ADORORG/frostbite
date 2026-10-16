import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { fromHex, toHex } from "../../src/bitcoin-alkanes/node/hex.ts";
import { parseAlkaneId } from "../../src/bitcoin-alkanes/node/alkane-id.ts";
import { claimScript } from "../../src/bitcoin-alkanes/tx/claim-call.ts";
import {
  encipherProtostone,
  splitBytes,
  varintList,
} from "../../src/bitcoin-alkanes/tx/protostone.ts";
import { runestoneScript } from "../../src/bitcoin-alkanes/tx/runestone.ts";

interface Vector {
  readonly calldata: string;
  readonly game: string;
  readonly key: string;
  readonly script: string;
}

const vectors = (
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          "../../../../contracts/templates/abi/claim-script-vectors.json",
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  ) as { readonly vectors: readonly Vector[] }
).vectors;

describe("the claim output script", () => {
  it("equals what an independent implementation of the encoding writes, for every vector", () => {
    expect(vectors.length).toBeGreaterThanOrEqual(3);
    for (const { game, key, script } of vectors) {
      const id = parseAlkaneId(game);
      expect(id, game).not.toBeNull();
      expect(
        toHex(claimScript(id ?? { block: 0n, tx: 0n }, BigInt(key))),
        game,
      ).toBe(script);
    }
  });

  it("carries the call as a varint list of target, opcode and milestone key", () => {
    for (const { calldata, game, key } of vectors) {
      const id = parseAlkaneId(game);
      const list = varintList([id?.block ?? 0n, id?.tx ?? 0n, 1n, BigInt(key)]);
      expect(toHex(list)).toBe(calldata);
    }
  });

  it("starts with OP_RETURN and the runestone magic number and fits a standard output", () => {
    for (const { script } of vectors) {
      const bytes = fromHex(script);
      expect([bytes[0], bytes[1]]).toEqual([0x6a, 0x5d]);
      expect(bytes.length).toBeLessThanOrEqual(80);
    }
  });
});

describe("the encoding steps", () => {
  it("cuts bytes into 15-byte little-endian numbers, the last one padded with zeros", () => {
    expect(splitBytes(new Uint8Array())).toEqual([]);
    expect(splitBytes(Uint8Array.of(1, 2))).toEqual([0x0201n]);
    const sixteen = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
    const [first, second] = splitBytes(sixteen);
    // Bytes 01 02 ... 0f, the first being the lowest.
    expect(first).toBe(0x0f0e0d0c0b0a090807060504030201n);
    expect(second).toBe(16n);
  });

  it("writes a protostone as tag, length and its fields, pointer and refund first", () => {
    const stone = {
      message: Uint8Array.of(7),
      pointer: 2,
      protocolTag: 1n,
      refund: 3,
    };
    const [packed] = encipherProtostone(stone);
    // Bytes 01 06 5b 02 5d 03 51 07: tag 1, six fields, then [91, 2, 93, 3, 81, 7], the first byte being the lowest.
    expect(packed).toBe(0x0751035d025b0601n);
    expect(encipherProtostone(stone)).toHaveLength(1);
  });

  it("splits a runestone payload into pushes of at most 520 bytes", () => {
    const protocol = Array.from({ length: 200 }, () => (1n << 100n) - 1n);
    const script = runestoneScript(0, protocol);
    expect(script[0]).toBe(0x6a);
    expect(script[1]).toBe(0x5d);
    // The first push is a 520-byte push: OP_PUSHDATA2 with its length.
    expect([script[2], script[3], script[4]]).toEqual([
      0x4d,
      520 & 0xff,
      520 >> 8,
    ]);
  });

  it("uses a one-byte length for pushes up to 75 bytes and OP_PUSHDATA1 up to 255", () => {
    const small = runestoneScript(0, [1n]);
    expect(small[2]).toBe(small.length - 3);
    const medium = runestoneScript(
      0,
      Array.from({ length: 12 }, () => (1n << 100n) - 1n),
    );
    expect(medium[2]).toBe(0x4c);
    expect(medium[3]).toBe(medium.length - 4);
  });
});

// A runestone whose payload (the pointer and the protocol entries) is exactly `length` bytes: the pointer takes 2, each entry 3
// bytes for a one-byte number or 4 for a two-byte number.
function scriptWithPayloadOf(length: number): Uint8Array {
  const body = length - 2;
  const wide = body % 3;
  const narrow = (body - 4 * wide) / 3;
  const protocol = [
    ...Array.from({ length: wide }, () => 128n),
    ...Array.from({ length: narrow }, () => 1n),
  ];
  return runestoneScript(0, protocol);
}

describe("script pushes at their size boundaries", () => {
  it("use a direct push up to 75 bytes, PUSHDATA1 up to 255, PUSHDATA2 up to 520, and a new push after that", () => {
    const head = (length: number) => [
      ...scriptWithPayloadOf(length).subarray(2, 5),
    ];
    expect(head(75)[0]).toBe(75);
    expect(head(76).slice(0, 2)).toEqual([0x4c, 76]);
    expect(head(255).slice(0, 2)).toEqual([0x4c, 255]);
    expect(head(256)).toEqual([0x4d, 0x00, 0x01]);
    expect(head(520)).toEqual([0x4d, 0x08, 0x02]);
    const long = scriptWithPayloadOf(521);
    // 2 header bytes, a 520-byte push (3 + 520), then a one-byte push (1 + 1).
    expect(long.length).toBe(2 + 3 + 520 + 2);
    expect(long[2 + 3 + 520]).toBe(1);
  });
});
