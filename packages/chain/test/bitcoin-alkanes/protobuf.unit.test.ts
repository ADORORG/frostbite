import { describe, expect, it } from "vitest";

import {
  MessageWriter,
  ProtobufError,
  encodeVarint,
  firstBytes,
  firstVarint,
  readFields,
  readVarint,
} from "../../src/bitcoin-alkanes/node/protobuf.ts";

describe("varints", () => {
  it("round-trip across the sizes an Alkanes number can take", () => {
    for (const value of [
      0n,
      1n,
      127n,
      128n,
      300n,
      2n ** 64n - 1n,
      2n ** 128n - 1n,
    ]) {
      const bytes = Uint8Array.from(encodeVarint(value));
      expect(readVarint(bytes, 0)).toEqual({ next: bytes.length, value });
    }
  });

  it("refuse a negative number, a cut-short number and an endless one", () => {
    expect(() => encodeVarint(-1n)).toThrow(ProtobufError);
    expect(() => readVarint(Uint8Array.of(0x80), 0)).toThrow("cut short");
    expect(() => readVarint(new Uint8Array(20).fill(0x80), 0)).toThrow(
      "too long",
    );
  });
});

describe("messages", () => {
  it("are read back field by field, in order", () => {
    const message = new MessageWriter()
      .varint(1, 300n)
      .bytesField(2, [1, 2, 3])
      .varint(1, 5n)
      .finish();
    const fields = readFields(message);
    expect(fields).toEqual([
      { kind: "varint", number: 1, value: 300n },
      { kind: "bytes", number: 2, value: Uint8Array.of(1, 2, 3) },
      { kind: "varint", number: 1, value: 5n },
    ]);
    expect(firstVarint(fields, 1)).toBe(300n);
    expect(firstBytes(fields, 2)).toEqual(Uint8Array.of(1, 2, 3));
  });

  it("answer undefined for a field of another kind or one that is not there", () => {
    const fields = readFields(
      new MessageWriter().varint(1, 1n).bytesField(2, []).finish(),
    );
    expect(firstBytes(fields, 1)).toBeUndefined();
    expect(firstVarint(fields, 2)).toBeUndefined();
    expect(firstBytes(fields, 9)).toBeUndefined();
    expect(firstVarint(fields, 9)).toBeUndefined();
  });

  it("skip fixed-width fields and refuse truncated or unsupported ones", () => {
    const fixed64 = Uint8Array.of(
      (3 << 3) | 1,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      (4 << 3) | 0,
      9,
    );
    expect(readFields(fixed64)).toEqual([
      { kind: "varint", number: 4, value: 9n },
    ]);
    const fixed32 = Uint8Array.of((3 << 3) | 5, 1, 2, 3, 4);
    expect(readFields(fixed32)).toEqual([]);
    expect(() => readFields(Uint8Array.of((3 << 3) | 1, 1, 2))).toThrow(
      "cut short",
    );
    expect(() => readFields(Uint8Array.of((3 << 3) | 2, 5, 1))).toThrow(
      "longer than the message",
    );
    expect(() => readFields(Uint8Array.of((3 << 3) | 3))).toThrow(
      "not supported",
    );
  });
});
