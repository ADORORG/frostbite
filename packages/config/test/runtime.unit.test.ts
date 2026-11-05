import { describe, expect, it } from "vitest";

import {
  parseAuthSessionEnvironment,
  parseEnvironment,
} from "../src/env/runtime.ts";

const validEnvironment = {
  APP_ENV: "test",
  PUBLIC_BASE_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_APP_NAME: "Frostbite",
};

describe("parseEnvironment", () => {
  it("returns a typed environment for valid input", () => {
    expect(parseEnvironment(validEnvironment)).toEqual(validEnvironment);
  });

  it("rejects a missing public application name", () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, NEXT_PUBLIC_APP_NAME: "" }),
    ).toThrow();
  });

  it("rejects an unsupported environment", () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, APP_ENV: "staging" }),
    ).toThrow();
  });
});

describe("parseAuthSessionEnvironment", () => {
  const validAuthEnvironment = {
    AUTH_SESSION_ABSOLUTE_TIMEOUT_MS: "604800000",
    AUTH_SESSION_IDLE_TIMEOUT_MS: "86400000",
    PASSKEY_CHALLENGE_TIMEOUT_MS: "300000",
    PASSKEY_RECENT_AUTH_WINDOW_MS: "600000",
  };

  it("parses positive session and passkey timeouts", () => {
    expect(parseAuthSessionEnvironment(validAuthEnvironment)).toEqual({
      AUTH_SESSION_ABSOLUTE_TIMEOUT_MS: 604_800_000,
      AUTH_SESSION_IDLE_TIMEOUT_MS: 86_400_000,
      PASSKEY_CHALLENGE_TIMEOUT_MS: 300_000,
      PASSKEY_RECENT_AUTH_WINDOW_MS: 600_000,
    });
  });

  it.each([undefined, "0", "invalid"])(
    "rejects invalid timeout %s",
    (value) => {
      expect(() =>
        parseAuthSessionEnvironment({
          ...validAuthEnvironment,
          AUTH_SESSION_IDLE_TIMEOUT_MS: value,
        }),
      ).toThrow();
    },
  );
});
