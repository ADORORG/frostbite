import type { AlkaneId } from "./alkane-id.ts";
import { fromHex, toHex } from "./hex.ts";
import {
  MessageWriter,
  encodeVarint,
  firstBytes,
  firstVarint,
  readFields,
} from "./protobuf.ts";

// `MessageContextParcel` and `SimulateResponse` from the indexer's `alkanes.proto`, reduced to the fields a read uses.

// A call is its target, then its opcode, then its arguments, each a varint (the indexer's cellpack encoding).
function calldata(target: AlkaneId, opcode: bigint, inputs: readonly bigint[]) {
  return [target.block, target.tx, opcode, ...inputs].flatMap(encodeVarint);
}

export function encodeSimulateRequest(
  height: number,
  target: AlkaneId,
  opcode: bigint,
  inputs: readonly bigint[],
): string {
  const parcel = new MessageWriter()
    .varint(4, BigInt(height))
    .bytesField(5, calldata(target, opcode, inputs))
    .finish();
  return `0x${toHex(parcel)}`;
}

// A `uint128` message holds the low and high 64 bits; an unset field is zero.
function uint128(value: bigint): number[] {
  const writer = new MessageWriter();
  const low = value & ((1n << 64n) - 1n);
  const high = value >> 64n;
  if (low !== 0n) writer.varint(1, low);
  if (high !== 0n) writer.varint(2, high);
  return Array.from(writer.finish());
}

export function encodeBytecodeRequest(target: AlkaneId): string {
  const id = new MessageWriter()
    .bytesField(1, uint128(target.block))
    .bytesField(2, uint128(target.tx))
    .finish();
  return `0x${toHex(new MessageWriter().bytesField(1, id).finish())}`;
}

export type ViewResult =
  | { readonly data: Uint8Array; readonly fuelUsed: bigint; readonly ok: true }
  | { readonly error: string; readonly ok: false };

// An answer carries `error` when the call reverted or the contract does not exist; otherwise the contract's `data`.
export function decodeSimulateResponse(hex: string): ViewResult {
  const fields = readFields(fromHex(hex));
  const error = firstBytes(fields, 3);
  if (error !== undefined) {
    return { error: new TextDecoder().decode(error), ok: false };
  }
  const execution = firstBytes(fields, 1);
  const data =
    execution === undefined
      ? new Uint8Array()
      : (firstBytes(readFields(execution), 3) ?? new Uint8Array());
  return { data, fuelUsed: firstVarint(fields, 2) ?? 0n, ok: true };
}
