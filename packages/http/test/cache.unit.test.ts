import { describe, expect, it } from "vitest";

import {
  assertCachePolicy,
  cacheControl,
  maxCacheSeconds,
} from "../src/cache.ts";

describe("what a cache policy says to a browser", () => {
  it("keeps nothing for no-store, whoever asks", () => {
    expect(cacheControl({ kind: "no-store" }, "private")).toBe("no-store");
    expect(cacheControl({ kind: "no-store" }, "public")).toBe("no-store");
  });

  it("allows keeping, but asking every time, for revalidate, private unless the answer is for everyone", () => {
    expect(cacheControl({ kind: "revalidate" }, "private")).toBe(
      "private, no-cache",
    );
    expect(cacheControl({ kind: "revalidate" }, "public")).toBe(
      "public, no-cache",
    );
  });

  it("gives the lifetime for max-age", () => {
    expect(cacheControl({ kind: "max-age", seconds: 3600 }, "private")).toBe(
      "private, max-age=3600",
    );
  });
});

describe("a cache lifetime", () => {
  it("is a whole number of seconds from 1 to a year", () => {
    for (const seconds of [1, 3600, maxCacheSeconds])
      expect(() =>
        assertCachePolicy({ kind: "max-age", seconds }),
      ).not.toThrow();
    for (const seconds of [0, -1, 1.5, maxCacheSeconds + 1, Number.NaN])
      expect(() => assertCachePolicy({ kind: "max-age", seconds })).toThrow(
        "whole number of seconds",
      );
  });

  it("has nothing to check for the other policies", () => {
    expect(() => assertCachePolicy({ kind: "revalidate" })).not.toThrow();
    expect(() => assertCachePolicy({ kind: "no-store" })).not.toThrow();
  });
});
