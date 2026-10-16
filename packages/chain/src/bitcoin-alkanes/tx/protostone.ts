import { encodeVarint } from "../node/protobuf.ts";

// How a call to an Alkane is written into a Bitcoin transaction, ported from `protorune-support` and `ordinals` at the
// `alkanes-rs` revision the templates are built against (`contracts/templates/Cargo.lock`). `contracts/templates/abi/
// claim-script-vectors.json` (written by an independent implementation) and the indexer harness check it.

// The runestone tag that carries protostones, and the protostone field tags.
const tags = { message: 81n, pointer: 91n, refund: 93n } as const;

// Bytes are carried 15 at a time in a 128-bit number, so the top byte is never set and a number never exceeds the runestone's limit.
const chunkBytes = 15;

export function splitBytes(bytes: Uint8Array): bigint[] {
  const chunks: bigint[] = [];
  for (let start = 0; start < bytes.length; start += chunkBytes) {
    let value = 0n;
    const chunk = bytes.subarray(start, start + chunkBytes);
    for (let index = chunk.length - 1; index >= 0; index -= 1) {
      value = (value << 8n) | BigInt(chunk[index] ?? 0);
    }
    chunks.push(value);
  }
  return chunks;
}

export function varintList(values: readonly bigint[]): Uint8Array {
  return Uint8Array.from(values.flatMap(encodeVarint));
}

export interface Protostone {
  // The call: its target and arguments, as `varintList` writes them.
  readonly message: Uint8Array;
  // Where tokens the call returns are sent, as an output index.
  readonly pointer: number;
  readonly protocolTag: bigint;
  // Where tokens go if the call reverts.
  readonly refund: number;
}

// The protostone as the runestone's `protocol` field carries it: its fields as numbers, the whole list written as varints and
// cut into 15-byte numbers.
export function encipherProtostone(stone: Protostone): bigint[] {
  const fields = [
    tags.pointer,
    BigInt(stone.pointer),
    tags.refund,
    BigInt(stone.refund),
    ...splitBytes(stone.message).flatMap((chunk) => [tags.message, chunk]),
  ];
  return splitBytes(
    varintList([stone.protocolTag, BigInt(fields.length), ...fields]),
  );
}
