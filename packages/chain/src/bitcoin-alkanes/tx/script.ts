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
