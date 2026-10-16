// The few protobuf constructs the Alkanes indexer's messages use: varints, length-delimited fields, and skipping the rest.
// Written here, not imported, so the shapes the platform trusts are the ones listed in this folder and tested against
// recorded responses.

export class ProtobufError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtobufError";
  }
}

// An Alkanes number is at most 128 bits, which a varint writes in at most 19 bytes.
const maxVarintBytes = 19;

export function encodeVarint(value: bigint): number[] {
  if (value < 0n) throw new ProtobufError("A varint cannot be negative.");
  const bytes: number[] = [];
  let rest = value;
  while (rest >= 0x80n) {
    bytes.push(Number(rest & 0x7fn) | 0x80);
    rest >>= 7n;
  }
  bytes.push(Number(rest));
  return bytes;
}

export function readVarint(
  bytes: Uint8Array,
  start: number,
): { readonly next: number; readonly value: bigint } {
  let value = 0n;
  for (let index = 0; index < maxVarintBytes; index += 1) {
    const byte = bytes[start + index];
    if (byte === undefined) throw new ProtobufError("A varint is cut short.");
    value |= BigInt(byte & 0x7f) << BigInt(7 * index);
    if ((byte & 0x80) === 0) return { next: start + index + 1, value };
  }
  throw new ProtobufError("A varint is too long.");
}

export class MessageWriter {
  private readonly bytes: number[] = [];

  varint(field: number, value: bigint): this {
    this.bytes.push(
      ...encodeVarint(BigInt((field << 3) | 0)),
      ...encodeVarint(value),
    );
    return this;
  }

  bytesField(field: number, value: Uint8Array | readonly number[]): this {
    this.bytes.push(
      ...encodeVarint(BigInt((field << 3) | 2)),
      ...encodeVarint(BigInt(value.length)),
      ...value,
    );
    return this;
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

export type Field =
  | { readonly kind: "varint"; readonly number: number; readonly value: bigint }
  | {
      readonly kind: "bytes";
      readonly number: number;
      readonly value: Uint8Array;
    };

const wireTypes = {
  fixed32: 5,
  fixed64: 1,
  lengthDelimited: 2,
  varint: 0,
} as const;

// Every field of one message, in order. Fixed-width fields are skipped; groups are refused.
export function readFields(bytes: Uint8Array): readonly Field[] {
  const fields: Field[] = [];
  let cursor = 0;
  while (cursor < bytes.length) {
    const tag = readVarint(bytes, cursor);
    cursor = tag.next;
    const number = Number(tag.value >> 3n);
    const wire = Number(tag.value & 7n);
    if (wire === wireTypes.varint) {
      const read = readVarint(bytes, cursor);
      cursor = read.next;
      fields.push({ kind: "varint", number, value: read.value });
    } else if (wire === wireTypes.lengthDelimited) {
      const length = readVarint(bytes, cursor);
      const start = length.next;
      const end = start + Number(length.value);
      if (length.value > BigInt(bytes.length) || end > bytes.length)
        throw new ProtobufError("A field is longer than the message.");
      fields.push({ kind: "bytes", number, value: bytes.slice(start, end) });
      cursor = end;
    } else if (wire === wireTypes.fixed64 || wire === wireTypes.fixed32) {
      cursor += wire === wireTypes.fixed64 ? 8 : 4;
      if (cursor > bytes.length)
        throw new ProtobufError("A fixed field is cut short.");
    } else {
      throw new ProtobufError(`Wire type ${wire} is not supported.`);
    }
  }
  return fields;
}

export function firstBytes(
  fields: readonly Field[],
  number: number,
): Uint8Array | undefined {
  const found = fields.find(
    (field) => field.number === number && field.kind === "bytes",
  );
  return found?.kind === "bytes" ? found.value : undefined;
}

export function firstVarint(
  fields: readonly Field[],
  number: number,
): bigint | undefined {
  const found = fields.find(
    (field) => field.number === number && field.kind === "varint",
  );
  return found?.kind === "varint" ? found.value : undefined;
}
