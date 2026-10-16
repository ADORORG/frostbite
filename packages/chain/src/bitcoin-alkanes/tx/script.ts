// The bytes of a script data push: a direct push up to 75 bytes, then `OP_PUSHDATA1` (to 255) and `OP_PUSHDATA2` (to 65535).
export function pushData(data: Uint8Array): number[] {
  const length = data.length;
  if (length <= 75) return [length, ...data];
  if (length <= 0xff) return [0x4c, length, ...data];
  return [0x4d, length & 0xff, length >> 8, ...data];
}

// The most bytes one script push may hold (consensus rule for script elements).
export const maxPushBytes = 520;

// Data as a run of pushes, each within the limit.
export function pushChunks(data: Uint8Array): number[] {
  const pushes: number[] = [];
  for (let start = 0; start < data.length; start += maxPushBytes) {
    pushes.push(...pushData(data.subarray(start, start + maxPushBytes)));
  }
  return pushes;
}

// The inverse of `pushData`: the data a run of pushes holds, from `start`, until the byte `stop` (not a push) or the end. Null if
// a push is cut short or is of a form `pushData` does not make.
export function readPushes(
  script: Uint8Array,
  start: number,
  stop: number,
): { readonly end: number; readonly pushes: Uint8Array[] } | null {
  const pushes: Uint8Array[] = [];
  let at = start;
  while (at < script.length && script[at] !== stop) {
    const opcode = script[at] ?? 0;
    let length = opcode;
    let header = 1;
    if (opcode === 0x4c) {
      length = script[at + 1] ?? -1;
      header = 2;
    } else if (opcode === 0x4d) {
      length = (script[at + 1] ?? 0) | ((script[at + 2] ?? 0) << 8);
      header = 3;
    } else if (opcode > 75) {
      return null;
    }
    if (length < 0 || at + header + length > script.length) return null;
    pushes.push(script.subarray(at + header, at + header + length));
    at += header + length;
  }
  return { end: at, pushes };
}
