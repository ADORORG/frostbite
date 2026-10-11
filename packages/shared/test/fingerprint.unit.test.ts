import { describe, expect, it } from "vitest";

import { requestFingerprint } from "../src/http/fingerprint.ts";

describe("request fingerprint", () => {
  it("is a 64-character lowercase hex digest", () => {
    expect(requestFingerprint({ a: 1 })).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("does not depend on key order, at any depth", () => {
    expect(
      requestFingerprint({ a: 1, b: { c: [1, { d: 2, e: 3 }], f: null } }),
    ).toBe(
      requestFingerprint({ b: { f: null, c: [1, { e: 3, d: 2 }] }, a: 1 }),
    );
  });

  it("changes with any change of content", () => {
    const base = requestFingerprint({ a: 1, list: [1, 2] });
    expect(requestFingerprint({ a: 2, list: [1, 2] })).not.toBe(base);
    expect(requestFingerprint({ a: 1, list: [2, 1] })).not.toBe(base);
    expect(requestFingerprint({ a: 1, list: [1, 2], extra: true })).not.toBe(
      base,
    );
  });

  it("tells values of different types apart", () => {
    expect(requestFingerprint({ a: "1" })).not.toBe(
      requestFingerprint({ a: 1 }),
    );
    expect(requestFingerprint({ a: null })).not.toBe(
      requestFingerprint({ a: "null" }),
    );
    expect(requestFingerprint([])).not.toBe(requestFingerprint({}));
  });

  it("is not fooled by text that looks like structure", () => {
    expect(requestFingerprint({ a: 'x","b":"y' })).not.toBe(
      requestFingerprint({ a: "x", b: "y" }),
    );
  });
});
