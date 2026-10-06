import { describe, expect, it } from "vitest";

import { ZodError } from "zod";

import { parseInngestEnvironment } from "../src/config.ts";

const valid = {
  APP_ENV: "local",
  INNGEST_APP_ID: "adorbitals",
  INNGEST_BASE_URL: "http://localhost:8288",
  INNGEST_DEV: "true",
  INNGEST_EVENT_KEY: "event-key",
  INNGEST_SIGNING_KEY: "signing-key",
};

describe("Inngest environment", () => {
  it("parses a development configuration", () => {
    expect(parseInngestEnvironment(valid)).toEqual({
      appId: "adorbitals",
      baseUrl: "http://localhost:8288",
      dev: true,
      eventKey: "event-key",
      signingKey: "signing-key",
    });
  });

  it("treats a blank base URL as Inngest Cloud and trims values", () => {
    const config = parseInngestEnvironment({
      ...valid,
      INNGEST_APP_ID: "  adorbitals  ",
      INNGEST_BASE_URL: "   ",
      INNGEST_DEV: "false",
    });
    expect(config).toMatchObject({ appId: "adorbitals", dev: false });
    expect(config.baseUrl).toBeUndefined();
    expect(
      parseInngestEnvironment({ ...valid, INNGEST_BASE_URL: undefined })
        .baseUrl,
    ).toBeUndefined();
  });

  it("accepts plain http outside development only for loopback hosts", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"])
      expect(
        parseInngestEnvironment({
          ...valid,
          INNGEST_BASE_URL: `http://${host}:8288`,
          INNGEST_DEV: "false",
        }).dev,
      ).toBe(false);
  });

  it("accepts an https base URL outside development and http inside it", () => {
    expect(
      parseInngestEnvironment({
        ...valid,
        INNGEST_BASE_URL: "https://inngest.example.test",
        INNGEST_DEV: "false",
      }).baseUrl,
    ).toBe("https://inngest.example.test");
    expect(parseInngestEnvironment(valid).baseUrl).toBe(
      "http://localhost:8288",
    );
  });

  it.each([
    [
      "a remote http base URL outside development",
      { INNGEST_BASE_URL: "http://inngest.example.test", INNGEST_DEV: "false" },
    ],
    ["a malformed base URL", { INNGEST_BASE_URL: "not a url" }],
    ["a missing app id", { INNGEST_APP_ID: undefined }],
    ["a blank app id", { INNGEST_APP_ID: " " }],
    ["a missing event key", { INNGEST_EVENT_KEY: undefined }],
    ["a blank signing key", { INNGEST_SIGNING_KEY: "" }],
    ["a missing development flag", { INNGEST_DEV: undefined }],
    ["a development flag that is not true or false", { INNGEST_DEV: "yes" }],
    ["a capitalised development flag", { INNGEST_DEV: "True" }],
  ])("rejects %s", (_name, overrides) => {
    expect(() => parseInngestEnvironment({ ...valid, ...overrides })).toThrow();
  });

  it.each(["preview", "production"])(
    "refuses development mode in %s, where request signatures would go unverified",
    (APP_ENV) => {
      expect(() => parseInngestEnvironment({ ...valid, APP_ENV })).toThrow(
        "INNGEST_DEV must be false",
      );
    },
  );

  it.each(["preview", "production"])(
    "accepts the signed configuration in %s",
    (APP_ENV) => {
      expect(
        parseInngestEnvironment({
          ...valid,
          APP_ENV,
          INNGEST_BASE_URL: "",
          INNGEST_DEV: "false",
        }).dev,
      ).toBe(false);
    },
  );

  it.each(["local", "test"])("allows development mode in %s", (APP_ENV) => {
    expect(parseInngestEnvironment({ ...valid, APP_ENV }).dev).toBe(true);
  });

  it.each([undefined, "staging", ""])("rejects APP_ENV=%s", (APP_ENV) => {
    expect(() => parseInngestEnvironment({ ...valid, APP_ENV })).toThrow();
  });

  it.each(["not a url", "http://[::1", "http://", "ftp://example.test"])(
    "reports a malformed or unsupported base URL %j as a validation error, not a parser crash",
    (INNGEST_BASE_URL) => {
      for (const INNGEST_DEV of ["true", "false"])
        expect(() =>
          parseInngestEnvironment({ ...valid, INNGEST_BASE_URL, INNGEST_DEV }),
        ).toThrow(ZodError);
    },
  );
});
