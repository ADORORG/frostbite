import { readFileSync } from "node:fs";

// A fresh copy per call so a test that mutates bytes cannot affect another test.
export function fixture(name: string): Uint8Array {
  return new Uint8Array(
    readFileSync(new URL(`../fixtures/${name}`, import.meta.url)),
  );
}

export function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
