import { describe, expect, it } from "vitest";

import {
  addressSchema,
  amountSchema,
  chainConfigListSchema,
  chainFamilyIdSchema,
  chainCapabilitySchema,
  chainNamespace,
  chainOptionSchema,
  chainRefTextSchema,
  chainReference,
  chainRefSchema,
  finalitySchema,
  jsonValueSchema,
  maxJsonDepth,
  type JsonValue,
} from "../src/chain/index.ts";

const bitcoin = "bip122:000000000019d6689c085ae165831e93";

describe("chainRefSchema", () => {
  it.each([
    "eip155:1",
    bitcoin,
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    "cosmos:cosmoshub-4",
    "abc:x",
  ])("accepts the CAIP-2 identifier %s", (value) => {
    expect(chainRefSchema.parse(value)).toBe(value);
  });

  it.each([
    "",
    "eip155",
    "eip155:",
    ":1",
    "ab:1",
    "toolongnamespace:1",
    "EIP155:1",
    `eip155:${"a".repeat(33)}`,
    "eip155:a b",
    "eip155:1:2",
    " eip155:1",
    "eip155:1\n",
  ])("rejects %j", (value) => {
    expect(chainRefSchema.safeParse(value).success).toBe(false);
  });

  it("splits a parsed reference into namespace and reference", () => {
    const parsed = chainRefSchema.parse(bitcoin);
    expect(chainNamespace(parsed)).toBe("bip122");
    expect(chainReference(parsed)).toBe("000000000019d6689c085ae165831e93");
  });
});

describe("chain option and text schemas", () => {
  it("projects a chain config to what a feature needs, without confirmation policy", () => {
    const option = {
      chainId: bitcoin,
      displayName: "Bitcoin signet",
      enabled: true,
      family: "bitcoin-alkanes",
      role: "public-beta",
    };
    expect(chainOptionSchema.safeParse(option).success).toBe(true);
    expect(
      chainOptionSchema.safeParse({ ...option, confirmations: {} }).success,
    ).toBe(false);
    expect(
      chainOptionSchema.safeParse({ ...option, enabled: "yes" }).success,
    ).toBe(false);
  });

  it("validates a chain reference as plain text, without a brand, for HTTP contracts", () => {
    expect(chainRefTextSchema.parse(bitcoin)).toBe(bitcoin);
    expect(chainRefTextSchema.safeParse("nope").success).toBe(false);
  });
});

describe("chainCapabilitySchema", () => {
  it.each(["address:codec", "allowlist-proof:merkle", "a:b:c"])(
    "accepts %s",
    (value) => {
      expect(chainCapabilitySchema.safeParse(value).success).toBe(true);
    },
  );

  it.each([
    "",
    "codec",
    "Address:codec",
    "address:",
    ":codec",
    "address codec",
  ])("rejects %j", (value) => {
    expect(chainCapabilitySchema.safeParse(value).success).toBe(false);
  });
});

describe("chainFamilyIdSchema", () => {
  it.each(["bitcoin-alkanes", "evm", "simulated"])("accepts %s", (value) => {
    expect(chainFamilyIdSchema.safeParse(value).success).toBe(true);
  });

  it.each(["", "Evm", "-evm", "evm-", "evm_x", "a".repeat(49), "1evm"])(
    "rejects %j",
    (value) => {
      expect(chainFamilyIdSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("value schemas", () => {
  const chain = chainRefSchema.parse("eip155:1");

  it("keeps an address attached to its chain and rejects stray fields", () => {
    expect(addressSchema.safeParse({ chain, value: "0xabc" }).success).toBe(
      true,
    );
    expect(addressSchema.safeParse({ chain, value: " " }).success).toBe(false);
    expect(
      addressSchema.safeParse({ chain, value: "x".repeat(257) }).success,
    ).toBe(false);
    expect(
      addressSchema.safeParse({ chain, extra: 1, value: "0xabc" }).success,
    ).toBe(false);
  });

  it("allows only non-negative bigint amounts", () => {
    const asset = { chain, id: "native", kind: "native" };
    expect(amountSchema.safeParse({ asset, baseUnits: 0n }).success).toBe(true);
    expect(amountSchema.safeParse({ asset, baseUnits: -1n }).success).toBe(
      false,
    );
    expect(amountSchema.safeParse({ asset, baseUnits: 1 }).success).toBe(false);
    expect(
      amountSchema.safeParse({
        asset: { ...asset, kind: "nft" },
        baseUnits: 1n,
      }).success,
    ).toBe(false);
  });

  it("requires at least one confirmation or finalization", () => {
    expect(
      finalitySchema.safeParse({ kind: "confirmations", required: 1 }).success,
    ).toBe(true);
    expect(
      finalitySchema.safeParse({ kind: "confirmations", required: 0 }).success,
    ).toBe(false);
    expect(
      finalitySchema.safeParse({ kind: "confirmations", required: 1.5 })
        .success,
    ).toBe(false);
    expect(finalitySchema.safeParse({ kind: "finalized" }).success).toBe(true);
    expect(finalitySchema.safeParse({ kind: "instant" }).success).toBe(false);
  });

  it("accepts nested JSON and rejects values JSON cannot carry", () => {
    expect(
      jsonValueSchema.safeParse({ a: [1, "b", null, { c: true }] }).success,
    ).toBe(true);
    expect(jsonValueSchema.safeParse(Number.NaN).success).toBe(false);
    expect(jsonValueSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(
      false,
    );
    expect(jsonValueSchema.safeParse(10n).success).toBe(false);
    expect(jsonValueSchema.safeParse(undefined).success).toBe(false);
    expect(jsonValueSchema.safeParse({ a: () => 1 }).success).toBe(false);
  });

  it("bounds nesting so hostile input fails validation instead of overflowing the stack", () => {
    const nested = (depth: number): JsonValue =>
      Array.from({ length: depth }).reduce<JsonValue>(
        (value) => [value],
        "leaf",
      );
    expect(jsonValueSchema.safeParse(nested(maxJsonDepth)).success).toBe(true);
    expect(jsonValueSchema.safeParse(nested(maxJsonDepth + 1)).success).toBe(
      false,
    );
    expect(() => jsonValueSchema.safeParse(nested(20_000))).not.toThrow();
    expect(jsonValueSchema.safeParse(nested(20_000)).success).toBe(false);
  });
});

describe("chainConfigListSchema", () => {
  const policy = {
    deploy: { kind: "confirmations", required: 3 },
    mint: { kind: "confirmations", required: 2 },
    "mint-milestone": { kind: "confirmations", required: 2 },
    transfer: { kind: "finalized" },
  };
  const entry = {
    chainId: bitcoin,
    confirmations: policy,
    displayName: "Bitcoin signet",
    enabled: true,
    family: "bitcoin-alkanes",
    releaseGate: "closed",
    role: "public-beta",
  };

  it("accepts a complete record", () => {
    expect(chainConfigListSchema.safeParse([entry]).success).toBe(true);
  });

  it.each(["deploy", "mint", "mint-milestone", "transfer"] as const)(
    "refuses a chain with no confirmation policy for %s",
    (operation) => {
      const rest = Object.fromEntries(
        Object.entries(policy).filter(([name]) => name !== operation),
      );
      expect(
        chainConfigListSchema.safeParse([{ ...entry, confirmations: rest }])
          .success,
      ).toBe(false);
    },
  );

  it("refuses duplicate chains, unknown fields, and unknown roles or gates", () => {
    expect(chainConfigListSchema.safeParse([entry, entry]).success).toBe(false);
    expect(
      chainConfigListSchema.safeParse([{ ...entry, network: "signet" }])
        .success,
    ).toBe(false);
    expect(
      chainConfigListSchema.safeParse([{ ...entry, role: "staging" }]).success,
    ).toBe(false);
    expect(
      chainConfigListSchema.safeParse([{ ...entry, releaseGate: true }])
        .success,
    ).toBe(false);
    expect(
      chainConfigListSchema.safeParse([{ ...entry, displayName: " " }]).success,
    ).toBe(false);
  });
});
