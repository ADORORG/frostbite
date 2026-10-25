import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createSetupLinkService,
  type SetupLinkRepository,
} from "../src/application/setup-link.ts";
import {
  encodeSetupToken,
  hashSetupToken,
  isSetupTokenShaped,
  setupTokenBytes,
} from "../src/application/setup-token.ts";

const now = new Date("2026-10-25T10:00:00.000Z");
const policy = { lifetimeMs: 3_600_000, policyVersion: "test-v2" };

function harness(mintResult: "minted" | "admin-exists" = "minted") {
  const calls = {
    mint: [] as Parameters<SetupLinkRepository["mint"]>[0][],
    redeem: [] as Parameters<SetupLinkRepository["redeem"]>[0][],
  };
  const repository: SetupLinkRepository = {
    mint: async (input) => {
      calls.mint.push(input);
      return { kind: mintResult };
    },
    redeem: async (input) => {
      calls.redeem.push(input);
      return { kind: "granted" };
    },
  };
  const service = createSetupLinkService({
    clock: () => now,
    policy,
    randomBytes: (length) => new Uint8Array(length).fill(7),
    repository,
  });
  return { calls, service };
}

describe("a setup token", () => {
  it("is 256 bits written in URL-safe characters, and only that shape is accepted", () => {
    const token = encodeSetupToken(new Uint8Array(setupTokenBytes).fill(255));
    expect(token).toHaveLength(43);
    expect(isSetupTokenShaped(token)).toBe(true);
    expect(isSetupTokenShaped(`${token}A`)).toBe(false);
    expect(isSetupTokenShaped(token.slice(1))).toBe(false);
    expect(isSetupTokenShaped(`${token.slice(1)}+`)).toBe(false);
    expect(isSetupTokenShaped("")).toBe(false);
  });

  it("refuses bytes of the wrong length rather than minting a weaker secret", () => {
    expect(() => encodeSetupToken(new Uint8Array(16))).toThrow(RangeError);
  });

  it("is stored as the SHA-256 of the token, in hex", () => {
    expect(hashSetupToken("abc")).toBe(
      createHash("sha256").update("abc").digest("hex"),
    );
    expect(hashSetupToken("abc")).not.toBe(hashSetupToken("abd"));
  });
});

describe("minting a setup link", () => {
  it("returns the token once and hands the repository only its hash and the expiry", async () => {
    const { calls, service } = harness();
    const result = await service.mint();
    if (result.kind !== "minted") throw new Error("expected a link");
    expect(result.expiresAt).toEqual(new Date("2026-10-25T11:00:00.000Z"));
    expect(calls.mint).toEqual([
      {
        expiresAt: result.expiresAt,
        now,
        tokenHash: hashSetupToken(result.token),
      },
    ]);
    expect(JSON.stringify(calls.mint)).not.toContain(result.token);
    expect(isSetupTokenShaped(result.token)).toBe(true);
  });

  it("draws a different token each time from the injected randomness", async () => {
    let counter = 0;
    const service = createSetupLinkService({
      clock: () => now,
      policy,
      randomBytes: (length) => new Uint8Array(length).fill(++counter),
      repository: {
        mint: async () => ({ kind: "minted" }),
        redeem: async () => ({ kind: "granted" }),
      },
    });
    const first = await service.mint();
    const second = await service.mint();
    if (first.kind !== "minted" || second.kind !== "minted")
      throw new Error("expected links");
    expect(first.token).not.toBe(second.token);
  });

  it("reveals no token when setup is already done", async () => {
    const { service } = harness("admin-exists");
    expect(await service.mint()).toEqual({ kind: "admin-exists" });
  });
});

describe("redeeming a setup link", () => {
  const request = { correlationId: "c1", userId: "u1" };

  it("passes the hash of the token, never the token, with the time and policy version", async () => {
    const { calls, service } = harness();
    const token = encodeSetupToken(new Uint8Array(setupTokenBytes).fill(9));
    expect(await service.redeem({ ...request, token })).toEqual({
      kind: "granted",
    });
    expect(calls.redeem).toEqual([
      {
        correlationId: "c1",
        now,
        policyVersion: "test-v2",
        tokenHash: hashSetupToken(token),
        userId: "u1",
      },
    ]);
    expect(JSON.stringify(calls.redeem)).not.toContain(token);
  });

  it("turns away anything that cannot be a token without asking the repository", async () => {
    const { calls, service } = harness();
    for (const token of ["", "short", "a".repeat(44), "!".repeat(43)])
      expect(await service.redeem({ ...request, token })).toEqual({
        kind: "invalid-link",
      });
    expect(calls.redeem).toHaveLength(0);
  });
});
