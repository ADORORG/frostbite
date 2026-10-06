import { assetRejectionReasons } from "@ador/shared/uploads";
import { describe, expect, it } from "vitest";

import { validateImage } from "../src/validate.ts";
import { fixture } from "./support/files.ts";

const limits = { maxDimension: 8_192, maxPixels: 40_000_000 };
const files = [
  ["real-rgb.png", "image/png"],
  ["real-rgba.png", "image/png"],
  ["real-baseline.jpg", "image/jpeg"],
  ["real-progressive.jpg", "image/jpeg"],
  ["real-lossy.webp", "image/webp"],
  ["real-lossless.webp", "image/webp"],
  ["real-alpha.webp", "image/webp"],
  ["real-alpha-lossy.webp", "image/webp"],
] as const;

// Deterministic generator (mulberry32) so a failure is reproducible from its seed and iteration.
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function mutate(source: Uint8Array, next: () => number): Uint8Array {
  const pick = (bound: number) => Math.floor(next() * bound);
  let bytes = source.slice();
  for (let edit = 1 + pick(4); edit > 0; edit -= 1) {
    const kind = pick(5);
    const at = pick(bytes.length);
    if (kind === 0) bytes[at] = pick(256);
    else if (kind === 1) bytes = bytes.slice(0, at);
    else if (kind === 2)
      bytes = Uint8Array.from([
        ...bytes.slice(0, at),
        pick(256),
        ...bytes.slice(at),
      ]);
    else if (kind === 3)
      bytes = Uint8Array.from([
        ...bytes.slice(0, at),
        ...bytes.slice(at + 1 + pick(8)),
      ]);
    else bytes[at] = 0xff;
    if (bytes.length === 0) bytes = Uint8Array.of(pick(256));
  }
  return bytes;
}

describe("validation of hostile byte streams", () => {
  it("never throws and always returns a coherent result for mutated real files", () => {
    const next = random(20_261_006);
    const reasons = new Set<string>(assetRejectionReasons);
    for (const [name, declaredMediaType] of files) {
      const source = fixture(name);
      for (let iteration = 0; iteration < 1_500; iteration += 1) {
        const bytes = mutate(source, next);
        const result = validateImage({ bytes, declaredMediaType, limits });
        const label = `${name} #${iteration}`;
        if (result.ok) {
          expect(result.width, label).toBeGreaterThan(0);
          expect(result.height, label).toBeGreaterThan(0);
          expect(result.width, label).toBeLessThanOrEqual(limits.maxDimension);
          expect(result.byteLength, label).toBe(bytes.length);
          expect(result.sha256, label).toMatch(/^[0-9a-f]{64}$/u);
        } else expect(reasons.has(result.reason), label).toBe(true);
      }
    }
  });

  it("never throws for arbitrary random bytes, with and without a valid signature", () => {
    const next = random(7);
    const prefixes = [
      [],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      [0xff, 0xd8, 0xff],
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    ];
    for (const prefix of prefixes)
      for (let iteration = 0; iteration < 1_500; iteration += 1) {
        const tail = Uint8Array.from({ length: Math.floor(next() * 64) }, () =>
          Math.floor(next() * 256),
        );
        const bytes = Uint8Array.from([...prefix, ...tail]);
        for (const declaredMediaType of [
          "image/png",
          "image/jpeg",
          "image/webp",
        ] as const)
          expect(() =>
            validateImage({ bytes, declaredMediaType, limits }),
          ).not.toThrow();
      }
  });
});
