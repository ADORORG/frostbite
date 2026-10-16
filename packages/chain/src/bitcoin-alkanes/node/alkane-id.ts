// An Alkane is named `block:tx`, two unsigned 128-bit numbers written in decimal.
export interface AlkaneId {
  readonly block: bigint;
  readonly tx: bigint;
}

const maxUint128 = (1n << 128n) - 1n;
const pattern = /^(0|[1-9]\d{0,38}):(0|[1-9]\d{0,38})$/u;

export function parseAlkaneId(text: string): AlkaneId | null {
  const match = pattern.exec(text);
  if (match === null) return null;
  const block = BigInt(match[1] ?? "");
  const tx = BigInt(match[2] ?? "");
  return block <= maxUint128 && tx <= maxUint128 ? { block, tx } : null;
}

export function formatAlkaneId(id: AlkaneId): string {
  return `${id.block}:${id.tx}`;
}
