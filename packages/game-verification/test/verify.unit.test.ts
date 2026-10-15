import { createHash } from "node:crypto";

import { canonicalJson, type RunRecord } from "@ador/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import { resolveVerificationPolicy } from "../src/policy.ts";
import { createVerifierRegistry } from "../src/registry.ts";
import { defineVerifier } from "../src/verifier.ts";
import { verifyRun } from "../src/verify.ts";
import {
  counterRules,
  counterSample,
  crashingRules,
  crashingSample,
} from "./counter-game.ts";

const registry = createVerifierRegistry([
  {
    gameId: "counting",
    sample: counterSample,
    verifier: defineVerifier(counterRules),
  },
  {
    gameId: "crashy",
    sample: crashingSample,
    verifier: defineVerifier(crashingRules),
  },
]);
const good = (over: Partial<RunRecord> = {}): RunRecord => ({
  claims: ["reached"],
  config: { target: 5 },
  gameId: "counting",
  inputs: [
    { data: 3, type: "add" },
    { data: 2, type: "add" },
  ],
  schemaVersion: 1,
  seed: 0,
  verifier: "counter",
  verifierVersion: 1,
  ...over,
});
const reason = (value: unknown, policy?: Parameters<typeof verifyRun>[2]) => {
  const result = verifyRun(registry, value, policy);
  return result.status === "rejected" ? result.reason : "verified";
};

describe("verifying a run record", () => {
  it("verifies a legal run that earned what it claims, and returns what it earned and its digest", () => {
    const record = good({ claims: ["reached", "exact"] });
    const result = verifyRun(registry, record);
    expect(result).toEqual({
      digest: createHash("sha256").update(canonicalJson(record)).digest("hex"),
      earned: ["reached", "exact"],
      status: "verified",
    });
  });

  it("verifies a run that claims less than it earned, and one that claims nothing", () => {
    expect(verifyRun(registry, good({ claims: ["reached"] })).status).toBe(
      "verified",
    );
    expect(verifyRun(registry, good({ claims: [] }))).toMatchObject({
      earned: ["reached", "exact"],
      status: "verified",
    });
  });

  it("refuses a claim the replay did not earn, naming it", () => {
    expect(
      verifyRun(registry, good({ claims: ["reached", "perfect"] })),
    ).toMatchObject({
      detail: "The run did not earn perfect.",
      reason: "claim-not-earned",
      status: "rejected",
    });
    expect(
      verifyRun(
        registry,
        good({ claims: ["reached"], inputs: [{ data: 1, type: "add" }] }),
      ).status,
    ).toBe("rejected");
  });

  it("gives the same digest to the same run however it was written, and another to any change", () => {
    const digestOf = (value: unknown) => {
      return verifyRun(registry, value).digest;
    };
    const record = good();
    // The same record with its keys written in the opposite order.
    const reordered = JSON.parse(
      JSON.stringify(Object.fromEntries(Object.entries(record).reverse())),
    );
    expect(digestOf(reordered)).toBe(digestOf(record));
    // Keys inside the record, not only its top level: the same settings written in another order.
    const settings = (config: Record<string, number>) =>
      digestOf(good({ config: { target: 5, ...config } }));
    expect(settings({ a: 1, b: 2 })).toBe(settings({ b: 2, a: 1 }));
    expect(settings({ a: 1, b: 2 })).not.toBe(settings({ a: 1, b: 3 }));
    expect(digestOf(good({ seed: 2 }))).not.toBe(digestOf(record));
    expect(digestOf(good({ claims: [] }))).not.toBe(digestOf(record));
  });

  it("refuses anything that is not a record, with where it went wrong, and never throws", () => {
    for (const bad of [
      null,
      undefined,
      1,
      "x",
      [],
      {},
      { ...good(), seed: -1 },
      { ...good(), extra: 1 },
    ]) {
      const result = verifyRun(registry, bad);
      expect(result).toMatchObject({
        digest: null,
        reason: "malformed",
        status: "rejected",
      });
    }
    expect(verifyRun(registry, { ...good(), seed: -1 })).toMatchObject({
      detail: expect.stringContaining("seed"),
    });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(reason(circular)).toBe("malformed");
  });

  it("refuses a record over the policy's size or step limits, before replaying it", () => {
    const inputs = Array.from({ length: 10 }, () => ({ data: 1, type: "add" }));
    expect(
      reason(
        good({ inputs, claims: [] }),
        resolveVerificationPolicy({ maxInputs: 9 }),
      ),
    ).toBe("too-many-inputs");
    expect(
      reason(
        good({ inputs, claims: [] }),
        resolveVerificationPolicy({ maxInputs: 10 }),
      ),
    ).toBe("verified");
    const big = good({
      config: { target: 5, padding: "x".repeat(400) },
      claims: [],
    });
    expect(
      reason(big, resolveVerificationPolicy({ maxRecordBytes: 256 })),
    ).toBe("too-large");
    const tooLarge = verifyRun(
      registry,
      big,
      resolveVerificationPolicy({ maxRecordBytes: 256 }),
    );
    expect(tooLarge.status === "rejected" && tooLarge.digest).toMatch(
      /^[0-9a-f]{64}$/u,
    );
  });

  it("counts the size in bytes, not characters", () => {
    const multi = good({
      config: { target: 5, note: "é".repeat(100) },
      claims: [],
    });
    const text = canonicalJson(multi);
    const bytes = new TextEncoder().encode(text).length;
    expect(bytes).toBeGreaterThan(text.length);
    expect(
      reason(multi, resolveVerificationPolicy({ maxRecordBytes: bytes - 1 })),
    ).toBe("too-large");
    expect(
      reason(multi, resolveVerificationPolicy({ maxRecordBytes: bytes })),
    ).toBe("verified");
  });

  it("refuses a game or verifier the platform does not hold, and another version of the rules", () => {
    // A game with no verifier, and a game whose verifier is named something else, are both unknown.
    expect(reason(good({ gameId: "other" }))).toBe("unknown-verifier");
    expect(reason(good({ verifier: "nothing" }))).toBe("unknown-verifier");
    const old = verifyRun(registry, good({ verifierVersion: 2 }));
    expect(old).toMatchObject({
      detail:
        "The record was made under version 2; the platform replays version 1.",
      reason: "version-mismatch",
    });
  });

  it("passes on why a replay failed: bad settings, an illegal input, or a verifier that failed", () => {
    expect(reason(good({ config: { target: 0 } }))).toBe("invalid-config");
    expect(reason(good({ inputs: [{ data: 7, type: "add" }] }))).toBe(
      "illegal-input",
    );
    expect(
      reason(
        good({
          gameId: "crashy",
          inputs: [{ type: "x" }],
          verifier: "crashing",
          claims: [],
        }),
      ),
    ).toBe("verifier-error");
  });
});
