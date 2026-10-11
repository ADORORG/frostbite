import { describe, expect, it } from "vitest";

import {
  jsonValueSchema,
  methodNames,
  methods,
  requestSchema,
  responseSchema,
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
  it("are exactly the six the platform offers", () => {
    expect(methodNames.sort()).toEqual([
      "milestones.list",
      "milestones.unlock",
      "player.info",
      "progress.load",
      "progress.save",
      "ready",
    ]);
  });

  it("take no parameters where none are needed, and refuse extra ones", () => {
    for (const name of [
      "milestones.list",
      "player.info",
      "progress.load",
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
