export class HexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HexError";
  }
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

// Bytes from hex text with or without a `0x` prefix. Odd length and non-hex characters are refused, not repaired.
export function fromHex(text: string): Uint8Array {
  const digits = text.startsWith("0x") ? text.slice(2) : text;
  if (digits.length % 2 !== 0 || !/^[0-9a-f]*$/iu.test(digits)) {
    throw new HexError("Not hexadecimal text.");
  }
  const bytes = new Uint8Array(digits.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(digits.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
