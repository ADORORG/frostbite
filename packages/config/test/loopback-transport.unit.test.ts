import { describe, expect, it } from "vitest";

import { environmentNames } from "../src/env/definitions.ts";
import {
  isHostedEnvironment,
  isSecureOrLoopbackUrl,
  isTransportAllowed,
} from "../src/transport/loopback-transport.ts";

const hosted = ["preview", "production"] as const;
const local = ["local", "test"] as const;

describe("hosted environments", () => {
  it.each(environmentNames)("classifies %s", (name) => {
    expect(isHostedEnvironment(name)).toBe(
      name === "preview" || name === "production",
    );
  });
});

describe("transport policy", () => {
  it.each([...hosted, ...local])("accepts https in %s", (environment) => {
    expect(
      isTransportAllowed("https://account.example.test/x", environment),
    ).toBe(true);
  });

  it.each(local)(
    "accepts plain http on loopback hosts in %s",
    (environment) => {
      for (const host of ["localhost", "127.0.0.1", "[::1]"])
        expect(isTransportAllowed(`http://${host}:9000`, environment)).toBe(
          true,
        );
    },
  );

  it.each(hosted)("refuses plain http on loopback in %s", (environment) => {
    expect(isTransportAllowed("http://127.0.0.1:9000", environment)).toBe(
      false,
    );
  });

  it.each([...hosted, ...local])(
    "refuses plain http on a remote host in %s",
    (environment) => {
      expect(
        isTransportAllowed("http://storage.example.test", environment),
      ).toBe(false);
      expect(
        isTransportAllowed("http://127.0.0.1.example.test", environment),
      ).toBe(false);
    },
  );

  it.each(["ftp://127.0.0.1", "not a url", "", "ws://localhost"])(
    "refuses %j",
    (value) => {
      expect(isTransportAllowed(value, "local")).toBe(false);
    },
  );
});

describe("environment-independent check", () => {
  it("accepts https and loopback http, and refuses everything else", () => {
    expect(isSecureOrLoopbackUrl("HTTPS://Example.test")).toBe(true);
    expect(isSecureOrLoopbackUrl("http://localhost:1")).toBe(true);
    expect(isSecureOrLoopbackUrl("http://example.test")).toBe(false);
    expect(isSecureOrLoopbackUrl("nonsense")).toBe(false);
  });

  it("treats the scheme case-insensitively in hosted environments", () => {
    expect(isTransportAllowed("HTTPS://example.test", "production")).toBe(true);
    expect(isTransportAllowed("HTTP://127.0.0.1", "production")).toBe(false);
  });
});
