import { describe, expect, it } from "vitest";

import {
  defaultDerivativePolicy,
  derivativeKinds,
  derivativeMaxSide,
  resolveDerivativePolicy,
} from "../src/uploads/index.ts";

describe("derivative policy", () => {
  it("owns the approved beta defaults as frozen typed policy", () => {
    expect(defaultDerivativePolicy).toEqual({
      maxDerivativeBytes: 5_000_000,
      previewMaxSide: 1_024,
      specVersion: "webp-v1",
      thumbnailMaxSide: 256,
      wallTimeMs: 30_000,
      webpQuality: 80,
      workerMaxHeapMegabytes: 512,
    });
    expect(Object.isFrozen(defaultDerivativePolicy)).toBe(true);
    expect(Object.isFrozen(resolveDerivativePolicy())).toBe(true);
    expect(derivativeKinds).toEqual(["thumbnail", "preview"]);
  });

  it("merges overrides over the defaults", () => {
    expect(
      resolveDerivativePolicy({ specVersion: "webp-v2", webpQuality: 90 }),
    ).toMatchObject({
      specVersion: "webp-v2",
      thumbnailMaxSide: 256,
      webpQuality: 90,
    });
  });

  it("maps each kind to its longest side", () => {
    const policy = resolveDerivativePolicy({
      previewMaxSide: 900,
      thumbnailMaxSide: 90,
    });
    expect(derivativeMaxSide(policy, "thumbnail")).toBe(90);
    expect(derivativeMaxSide(policy, "preview")).toBe(900);
  });

  it.each([
    ["a preview no larger than the thumbnail", { previewMaxSide: 256 }],
    ["a preview smaller than the thumbnail", { previewMaxSide: 100 }],
    ["a quality of zero", { webpQuality: 0 }],
    ["a quality above one hundred", { webpQuality: 101 }],
    ["a fractional quality", { webpQuality: 80.5 }],
    ["a blank spec version", { specVersion: "  " }],
    ["a zero wall time", { wallTimeMs: 0 }],
    ["a negative byte cap", { maxDerivativeBytes: -1 }],
    ["a zero heap", { workerMaxHeapMegabytes: 0 }],
    ["a zero thumbnail", { thumbnailMaxSide: 0 }],
  ])("rejects %s", (_name, overrides) => {
    expect(() => resolveDerivativePolicy(overrides)).toThrow();
  });

  it("accepts the quality bounds", () => {
    expect(resolveDerivativePolicy({ webpQuality: 1 }).webpQuality).toBe(1);
    expect(resolveDerivativePolicy({ webpQuality: 100 }).webpQuality).toBe(100);
  });
});
