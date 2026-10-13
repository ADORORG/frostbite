import { describe, expect, it } from "vitest";

import {
  eventMessageSchema,
  eventNames,
  events,
  jsonValueSchema,
  methodNames,
  methods,
  requestSchema,
  requiredCapability,
  requiredEventCapability,
  responseSchema,
  toastMaxLength,
  walletInfoSchema,
} from "../src/protocol.ts";
import {
  defaultGameHostPolicy,
  gameHostPolicySchema,
  resolveGameHostPolicy,
} from "../src/policy.ts";

describe("saved values", () => {
  it.each([null, true, 0, -1.5, "text", [], {}, { a: [1, { b: null }] }])(
    "accept the JSON value %j",
    (value) => {
      expect(jsonValueSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each([
    ["undefined", undefined],
    ["a function", () => 1],
    ["not a number", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["a date", new Date()],
    ["a symbol", Symbol("x")],
    ["a nested undefined", { a: undefined }],
    ["a big integer", 10n],
  ])("refuse %s", (_why, value) => {
    expect(jsonValueSchema.safeParse(value).success).toBe(false);
  });
});

describe("requests and responses", () => {
  const base = { channel: "ador-game", id: "r1", version: 1 };

  it("take a request with any method name and parameters, to be checked once the method is known", () => {
    expect(
      requestSchema.safeParse({ ...base, method: "x", params: 5 }).success,
    ).toBe(true);
  });

  it.each([
    [
      "another channel",
      { ...base, channel: "other", method: "ready", params: {} },
    ],
    ["another version", { ...base, method: "ready", params: {}, version: 2 }],
    [
      "no id",
      { channel: "ador-game", method: "ready", params: {}, version: 1 },
    ],
    ["an empty id", { ...base, id: "", method: "ready", params: {} }],
    ["a long id", { ...base, id: "x".repeat(65), method: "ready", params: {} }],
    ["a long method", { ...base, method: "m".repeat(65), params: {} }],
    ["an extra field", { ...base, extra: 1, method: "ready", params: {} }],
  ])("refuse a request with %s", (_why, value) => {
    expect(requestSchema.safeParse(value).success).toBe(false);
  });

  it("separate success from failure, and refuse an error code that does not exist", () => {
    expect(
      responseSchema.safeParse({ ...base, ok: true, result: {} }).success,
    ).toBe(true);
    expect(
      responseSchema.safeParse({
        ...base,
        error: { code: "too_large", message: "no" },
        ok: false,
      }).success,
    ).toBe(true);
    expect(
      responseSchema.safeParse({
        ...base,
        error: { code: "teapot", message: "no" },
        ok: false,
      }).success,
    ).toBe(false);
    expect(responseSchema.safeParse({ ...base, ok: "yes" }).success).toBe(
      false,
    );
  });
});

describe("the methods", () => {
  it("are exactly the twelve the platform offers", () => {
    expect(methodNames.sort()).toEqual([
      "capabilities.get",
      "milestones.counts",
      "milestones.list",
      "milestones.progress",
      "milestones.unlock",
      "player.identity",
      "player.info",
      "progress.load",
      "progress.save",
      "ready",
      "ui.toast",
      "wallet.get",
    ]);
  });

  it("take no parameters where none are needed, and refuse extra ones", () => {
    for (const name of [
      "capabilities.get",
      "milestones.counts",
      "milestones.list",
      "player.info",
      "progress.load",
      "wallet.get",
    ] as const) {
      expect(methods[name].params.safeParse({}).success).toBe(true);
      expect(methods[name].params.safeParse({ extra: 1 }).success).toBe(false);
    }
  });

  it("bound the milestone id and require a positive SDK version", () => {
    expect(
      methods["milestones.unlock"].params.safeParse({ id: "" }).success,
    ).toBe(false);
    expect(
      methods["milestones.unlock"].params.safeParse({ id: "x".repeat(65) })
        .success,
    ).toBe(false);
    expect(methods.ready.params.safeParse({ sdkVersion: 0 }).success).toBe(
      false,
    );
    expect(methods.ready.params.safeParse({ sdkVersion: 1 }).success).toBe(
      true,
    );
  });

  it("only know a milestone as locked or unlocked, with a time when it is unlocked", () => {
    const result = methods["milestones.list"].result;
    const milestone = {
      claimPolicy: "once",
      criteria: "c",
      description: "d",
      id: "a",
      status: "unlocked",
      title: "t",
      unlockedAt: "2026-10-12T10:00:00.000Z",
      verification: "self-reported",
    };
    expect(result.safeParse({ milestones: [milestone] }).success).toBe(true);
    expect(
      result.safeParse({ milestones: [{ ...milestone, status: "claimed" }] })
        .success,
    ).toBe(false);
    expect(
      result.safeParse({
        milestones: [{ ...milestone, verification: "verified" }],
      }).success,
    ).toBe(false);
  });
});

describe("the host policy", () => {
  it("defaults to the product owner's 64 KB", () => {
    expect(defaultGameHostPolicy.progressMaxBytes).toBe(65_536);
    expect(resolveGameHostPolicy().progressMaxBytes).toBe(65_536);
  });

  it("can be overridden, and refuses values outside its bounds", () => {
    expect(
      resolveGameHostPolicy({ progressMaxBytes: 16_384 }).progressMaxBytes,
    ).toBe(16_384);
    for (const bad of [
      { progressMaxBytes: 100 },
      { progressMaxBytes: 2_000_000 },
      { saveCallsPerMinute: 0 },
      { unlockCallsPerMinute: 601 },
    ])
      expect(() => resolveGameHostPolicy(bad)).toThrow();
    expect(
      gameHostPolicySchema.safeParse({ ...defaultGameHostPolicy, extra: 1 })
        .success,
    ).toBe(false);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(resolveGameHostPolicy())).toBe(true);
  });
});

describe("the wallet and the events", () => {
  const address =
    "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv";

  it("describe a wallet by its public address and network name, and nothing else", () => {
    expect(
      walletInfoSchema.safeParse({ address, network: "signet" }).success,
    ).toBe(true);
    for (const wallet of [
      { address, network: "signet", publicKey: "02ab" },
      { address: "", network: "signet" },
      { address: "has space in it", network: "signet" },
      { address: `${address}${address}`, network: "signet" },
      { address, network: "Signet" },
      { address, network: "" },
    ])
      expect(walletInfoSchema.safeParse(wallet).success).toBe(false);
  });

  it("know four events, each with strict data", () => {
    expect(eventNames.sort()).toEqual([
      "fullscreen.changed",
      "lifecycle.changed",
      "player.changed",
      "wallet.changed",
    ]);
    expect(
      events["lifecycle.changed"].safeParse({ state: "paused" }).success,
    ).toBe(true);
    expect(
      events["lifecycle.changed"].safeParse({ state: "asleep" }).success,
    ).toBe(false);
    expect(events["fullscreen.changed"].safeParse({ active: 1 }).success).toBe(
      false,
    );
    expect(events["wallet.changed"].safeParse({ wallet: null }).success).toBe(
      true,
    );
    expect(events["wallet.changed"].safeParse({}).success).toBe(false);
  });

  it("are not responses, so a game built before them ignores them", () => {
    const message = {
      channel: "ador-game",
      data: { active: true },
      event: "fullscreen.changed",
      version: 1,
    };
    expect(eventMessageSchema.safeParse(message).success).toBe(true);
    expect(responseSchema.safeParse(message).success).toBe(false);
  });

  it("bound a toast to a short plain message", () => {
    const params = methods["ui.toast"].params;
    expect(params.safeParse({ message: "Level up!" }).success).toBe(true);
    expect(params.safeParse({ message: "   " }).success).toBe(false);
    expect(
      params.safeParse({ message: "x".repeat(toastMaxLength) }).success,
    ).toBe(true);
    expect(
      params.safeParse({ message: "x".repeat(toastMaxLength + 1) }).success,
    ).toBe(false);
  });

  it("need the wallet capability for the address and the wallet event, and nothing else", () => {
    expect(requiredCapability).toEqual({ "wallet.get": "wallet" });
    expect(requiredEventCapability).toEqual({ "wallet.changed": "wallet" });
  });
});
