// A witness as the PSBT stores it once an input is finalized: a count, then each item behind its length, all as Bitcoin's
// variable-length integers. Null if the bytes are cut short or leave anything over.
function readCompactSize(
  bytes: Uint8Array,
  at: number,
): { readonly next: number; readonly value: number } | null {
  const first = bytes[at];
  if (first === undefined) return null;
  const widths: Readonly<Record<number, number>> = { 0xfd: 2, 0xfe: 4 };
  const width = widths[first];
  if (width === undefined) {
    return first < 0xfd ? { next: at + 1, value: first } : null;
  }
  if (at + 1 + width > bytes.length) return null;
  let value = 0;
  for (let index = width - 1; index >= 0; index -= 1) {
    value = value * 256 + (bytes[at + 1 + index] ?? 0);
  }
  return { next: at + 1 + width, value };
}

export function witnessItems(witness: Uint8Array): Uint8Array[] | null {
  const count = readCompactSize(witness, 0);
  if (count === null) return null;
  const items: Uint8Array[] = [];
  let at = count.next;
  for (let index = 0; index < count.value; index += 1) {
    const length = readCompactSize(witness, at);
    if (length === null || length.next + length.value > witness.length) {
      return null;
    }
    items.push(witness.subarray(length.next, length.next + length.value));
    at = length.next + length.value;
  }
  return at === witness.length ? items : null;
}
