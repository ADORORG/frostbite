import { GameHostError } from "@ador/game-sdk/client";
import { methodNames } from "@ador/game-sdk/protocol";
import { describe, expect, it } from "vitest";

import {
  attempt,
  describeEvent,
  describeOutcome,
  probes,
} from "../src/probes.ts";

describe("the calls the explorer offers", () => {
  it("cover every method the SDK has except the handshake, once each", () => {
    expect(probes.map(({ label }) => label).sort()).toEqual(
      methodNames.filter((name) => name !== "ready").sort(),
    );
    expect(new Set(probes.map(({ id }) => id)).size).toBe(probes.length);
  });
});

describe("an attempt", () => {
  it("returns what came back", async () => {
    expect(await attempt(async () => ({ a: 1 }))).toEqual({
      kind: "result",
      value: { a: 1 },
    });
  });

  it("returns a refusal from the platform as the answer, with its code", async () => {
    expect(
      await attempt(async () => {
        throw new GameHostError("permission_denied", "Not asked for.");
      }),
    ).toEqual({
      code: "permission_denied",
      kind: "refused",
      message: "Not asked for.",
    });
  });

  it("does not hide a failure that is not the platform's", async () => {
    await expect(
      attempt(async () => {
        throw new TypeError("a bug in the page");
      }),
    ).rejects.toThrow("a bug in the page");
  });
});

describe("the log lines", () => {
  it("say what was called and what it returned or why it was refused", () => {
    expect(
      describeOutcome("wallet.get", {
        kind: "result",
        value: { wallet: null },
      }),
    ).toBe('wallet.get → {"wallet":null}');
    expect(
      describeOutcome("wallet.get", {
        code: "permission_denied",
        kind: "refused",
        message: "No.",
      }),
    ).toBe("wallet.get → refused (permission_denied): No.");
    expect(describeEvent("lifecycle.changed", { state: "paused" })).toBe(
      'event lifecycle.changed {"state":"paused"}',
    );
  });
});
