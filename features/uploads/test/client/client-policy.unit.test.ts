import { describe, expect, it } from "vitest";

import {
  defaultUploadClientPolicy,
  resolveUploadClientPolicy,
} from "../../src/client/client-policy.ts";

describe("upload client policy", () => {
  it("owns documented defaults and applies overrides", () => {
    expect(resolveUploadClientPolicy()).toEqual(defaultUploadClientPolicy);
    expect(resolveUploadClientPolicy({ pollIntervalMs: 10 })).toEqual({
      ...defaultUploadClientPolicy,
      pollIntervalMs: 10,
    });
    expect(Object.isFrozen(resolveUploadClientPolicy())).toBe(true);
  });

  it("gives a stalled send thirty seconds by default", () => {
    expect(defaultUploadClientPolicy.transferStallMs).toBe(30_000);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects %s",
    (value) => {
      expect(() =>
        resolveUploadClientPolicy({ pollMaxAttempts: value }),
      ).toThrow("pollMaxAttempts");
    },
  );
});
