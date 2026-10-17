import { describe, expect, it } from "vitest";

import {
  observationSchema,
  transactionIntentSchema,
  transactionSummarySchema,
} from "../src/chain/index.ts";

const chain = "bip122:00000008819873e925422c1ff0f99f7c";
const other = "bip122:000000000019d6689c085ae165831e93";
const family = "bitcoin-alkanes";
const sender = { chain, value: "tb1qsender" };
const at = (id: string, on = chain) => ({ chain: on, family, id });
const asset = { chain, id: "btc", kind: "native" };

const publish = {
  chain,
  operation: "publish-template",
  sender,
  templateAt: at("4:100"),
  templateId: "game-rewards",
  templateVersion: "1.0.0",
};
const deploy = {
  chain,
  collectibleAt: at("4:101"),
  maxDrawingBytes: 4096,
  operation: "deploy",
  sender,
  templateAt: at("4:100"),
  templateId: "game-rewards",
  templateVersion: "1.0.0",
};

describe("publishing a template and creating a game", () => {
  it("name where the templates are published and how large a drawing the contract accepts", () => {
    expect(transactionIntentSchema.parse(publish)).toEqual(publish);
    expect(transactionIntentSchema.parse(deploy)).toEqual(deploy);
  });

  it("still accept the plain forms a chain without these needs", () => {
    const omit = (value: object, ...keys: string[]) =>
      Object.fromEntries(
        Object.entries(value).filter(([name]) => !keys.includes(name)),
      );
    expect(
      transactionIntentSchema.safeParse(omit(publish, "templateAt")).success,
    ).toBe(true);
    expect(
      transactionIntentSchema.safeParse(
        omit(deploy, "collectibleAt", "maxDrawingBytes", "templateAt"),
      ).success,
    ).toBe(true);
  });

  it("refuse a template published on another chain than the step's", () => {
    for (const intent of [
      { ...publish, templateAt: at("4:100", other) },
      { ...deploy, templateAt: at("4:100", other) },
      { ...deploy, collectibleAt: at("4:101", other) },
    ]) {
      expect(transactionIntentSchema.safeParse(intent).success).toBe(false);
    }
  });

  it("refuse a drawing size that is not a positive whole number", () => {
    for (const maxDrawingBytes of [0, -1, 1.5]) {
      expect(
        transactionIntentSchema.safeParse({ ...deploy, maxDrawingBytes })
          .success,
      ).toBe(false);
    }
  });
});

describe("the summary of those steps", () => {
  const summary = {
    chain,
    collectibleAt: at("4:101"),
    expiresAt: "2026-10-09T12:00:00.000Z",
    fee: { asset, baseUnits: 1n },
    maxDrawingBytes: 4096,
    operation: "deploy",
    template: {
      at: at("4:100"),
      codeHash: "a".repeat(64),
      id: "game-rewards",
      version: "1.0.0",
    },
  };

  it("shows where the code is and what the contract is created with", () => {
    expect(transactionSummarySchema.parse(summary)).toEqual(summary);
  });

  it("refuses a reference to another chain", () => {
    expect(
      transactionSummarySchema.safeParse({
        ...summary,
        template: { ...summary.template, at: at("4:100", other) },
      }).success,
    ).toBe(false);
    expect(
      transactionSummarySchema.safeParse({
        ...summary,
        collectibleAt: at("4:101", other),
      }).success,
    ).toBe(false);
  });

  it("refuses a drawing size that is not a positive whole number", () => {
    expect(
      transactionSummarySchema.safeParse({ ...summary, maxDrawingBytes: 0 })
        .success,
    ).toBe(false);
  });
});

describe("an observation that names the contracts a step created", () => {
  const observation = {
    block: { chain, hash: "ab".repeat(32), height: 10 },
    confirmations: 1,
    observedAt: "2026-10-09T12:00:00.000Z",
    provider: "node",
    ref: { chain, id: "cd".repeat(32) },
    status: "confirmed",
  };

  it("lists them in order, and may list none", () => {
    expect(
      observationSchema.parse({ ...observation, created: ["2:1", "2:2"] })
        .created,
    ).toEqual(["2:1", "2:2"]);
    expect(observationSchema.parse(observation).created).toBeUndefined();
  });

  it("refuses an empty or oversized name", () => {
    for (const created of [[""], ["x".repeat(129)], [" "]]) {
      expect(
        observationSchema.safeParse({ ...observation, created }).success,
      ).toBe(false);
    }
  });
});
