import { describe, expect, it } from "vitest";

import { parseSecurityEnvironment } from "../src/env/runtime.ts";

describe("parseSecurityEnvironment", () => {
  it("defaults to reporting before blocking, one trusted proxy, and no storage origin", () => {
    expect(parseSecurityEnvironment({})).toEqual({
      cspMode: "report-only",
      storageOrigin: null,
      trustedProxyHops: 1,
    });
  });

  it.each(["", "   "])("treats a blank %j value as unset", (blank) => {
    expect(
      parseSecurityEnvironment({
        R2_ENDPOINT: blank,
        SECURITY_CSP_MODE: blank,
        TRUSTED_PROXY_HOPS: blank,
      }),
    ).toEqual({
      cspMode: "report-only",
      storageOrigin: null,
      trustedProxyHops: 1,
    });
  });

  it("reads the mode, the number of proxies and the storage origin", () => {
    expect(
      parseSecurityEnvironment({
        R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com/some/path",
        SECURITY_CSP_MODE: "enforce",
        TRUSTED_PROXY_HOPS: "0",
      }),
    ).toEqual({
      cspMode: "enforce",
      storageOrigin: "https://acct.r2.cloudflarestorage.com",
      trustedProxyHops: 0,
    });
    expect(
      parseSecurityEnvironment({ R2_ENDPOINT: "http://localhost:9000" })
        .storageOrigin,
    ).toBe("http://localhost:9000");
  });

  it.each([
    ["an unknown mode", { SECURITY_CSP_MODE: "block" }],
    ["too many proxies", { TRUSTED_PROXY_HOPS: "6" }],
    ["a negative number", { TRUSTED_PROXY_HOPS: "-1" }],
    ["a fraction", { TRUSTED_PROXY_HOPS: "1.5" }],
    ["text", { TRUSTED_PROXY_HOPS: "one" }],
  ])("refuses %s", (_why, source) => {
    expect(() => parseSecurityEnvironment(source)).toThrow();
  });

  it.each(["preview", "production"])(
    "refuses no trusted proxy in %s, where every per-address limit would be switched off",
    (APP_ENV) => {
      expect(() =>
        parseSecurityEnvironment({ APP_ENV, TRUSTED_PROXY_HOPS: "0" }),
      ).toThrow("TRUSTED_PROXY_HOPS=0");
      // Left blank it is one proxy, and a real number of proxies is accepted.
      expect(
        parseSecurityEnvironment({ APP_ENV, TRUSTED_PROXY_HOPS: "" })
          .trustedProxyHops,
      ).toBe(1);
      expect(
        parseSecurityEnvironment({ APP_ENV, TRUSTED_PROXY_HOPS: "2" })
          .trustedProxyHops,
      ).toBe(2);
    },
  );

  it.each(["local", "test"])(
    "allows no trusted proxy in %s, a developer's own machine",
    (APP_ENV) => {
      expect(
        parseSecurityEnvironment({ APP_ENV, TRUSTED_PROXY_HOPS: "0" })
          .trustedProxyHops,
      ).toBe(0);
    },
  );

  it("has no storage origin when the endpoint is not an address", () => {
    expect(
      parseSecurityEnvironment({ R2_ENDPOINT: "not a url" }).storageOrigin,
    ).toBeNull();
  });
});
