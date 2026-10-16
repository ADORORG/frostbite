import { encodeVarint } from "../node/protobuf.ts";

const opReturn = 0x6a;
// The magic number that marks a runestone (`OP_PUSHNUM_13`).
const opPushNum13 = 0x5d;
// The runestone tags this file writes.
const tags = { pointer: 22n, protocol: 16383n } as const;
// The most bytes one script push may hold.
const maxPush = 520;

function push(data: Uint8Array): number[] {
  const length = data.length;
  if (length <= 75) return [length, ...data];
  if (length <= 0xff) return [0x4c, length, ...data];
  return [0x4d, length & 0xff, length >> 8, ...data];
}

// The `OP_RETURN` output that carries protostones: `pointer` is where unallocated tokens go, `protocol` the enciphered stones.
export function runestoneScript(
  pointer: number,
  protocol: readonly bigint[],
): Uint8Array {
  const payload = Uint8Array.from([
    ...encodeVarint(tags.pointer),
    ...encodeVarint(BigInt(pointer)),
    ...protocol.flatMap((value) => [
      ...encodeVarint(tags.protocol),
      ...encodeVarint(value),
    ]),
  ]);
  const pushes: number[] = [];
  for (let start = 0; start < payload.length; start += maxPush) {
    pushes.push(...push(payload.subarray(start, start + maxPush)));
  }
  return Uint8Array.from([opReturn, opPushNum13, ...pushes]);
}
