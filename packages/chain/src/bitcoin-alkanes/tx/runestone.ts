import { encodeVarint } from "../node/protobuf.ts";
import { pushChunks } from "./script.ts";

const opReturn = 0x6a;
// The magic number that marks a runestone (`OP_PUSHNUM_13`).
const opPushNum13 = 0x5d;
// The runestone tags this file writes.
const tags = { pointer: 22n, protocol: 16383n } as const;

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
  return Uint8Array.from([opReturn, opPushNum13, ...pushChunks(payload)]);
}
