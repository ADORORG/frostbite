import { sha256Hex, type FetchLike } from "@ador/chain/bitcoin-alkanes";
import { describe, expect, it } from "vitest";

import { exitCodeOf, formatReport, messageOf } from "../src/result.ts";
import { runPreflight } from "../src/run.ts";

const code = new Uint8Array([0, 97, 115, 109]);
const policy = {
  delay: { maxLagBlocks: 2, maxUnsettledMs: 3_600_000 },
  feeTargetBlocks: 3,
  templates: [
    { codeHash: sha256Hex(code), crate: "game-rewards", version: "1.0.0" },
  ],
} as const;
const env = {
  REWARDS_CHAIN_RPC_URL: "https://node.example/v4/jsonrpc",
  REWARDS_MAX_FEE_SATS: "500000",
  REWARDS_TEMPLATES_DIR: "/templates",
};

// A node that answers each method from a table; a method with an Error in it is refused as the stalled endpoint refuses it.
function nodeAnswering(
  answers: Readonly<Record<string, string | number | object | Error>>,
): FetchLike {
  return async (_url, init) => {
    const call = JSON.parse(init.body) as { id: number; method: string };
    const answer = answers[call.method];
    const body =
      answer instanceof Error
        ? { error: { message: answer.message }, id: call.id, jsonrpc: "2.0" }
        : { id: call.id, jsonrpc: "2.0", result: answer };
    return { json: async () => body, ok: true, status: 200 };
  };
}

const healthy = {
  "esplora_blocks:tip:hash": "00",
  "esplora_blocks:tip:height": 100,
  "esplora_fee-estimates": { "3": 2 },
  metashrew_height: "100",
  metashrew_view: "0x0061736d",
};
const platform = (answers: Parameters<typeof nodeAnswering>[0]) => ({
  fetch: nodeAnswering(answers),
  readFile: async () => code,
});

describe("the whole preflight", () => {
  it("passes every check against a healthy node with the released code", async () => {
    const results = await runPreflight(env, platform(healthy), policy);
    expect(results.map(({ verdict }) => verdict)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
      "pass",
    ]);
    expect(exitCodeOf(results)).toBe(0);
  });

  it("reports a stalled indexer as a failure and the reads it blocks as unverified", async () => {
    const stalled = new Error("no backend in sync (served 100, chain tip 120)");
    const results = await runPreflight(
      env,
      platform({
        ...healthy,
        metashrew_height: stalled,
        metashrew_view: stalled,
      }),
      policy,
    );
    const byName = Object.fromEntries(
      results.map((result) => [result.name, result.verdict]),
    );
    expect(byName["Indexer is keeping up with the chain"]).toBe("unverified");
    expect(byName["Auth-token factory exists"]).toBe("unverified");
    expect(byName["Publishing a template fits the fee ceiling"]).toBe("pass");
    expect(exitCodeOf(results)).toBe(2);
  });

  it("checks nothing against the node when the settings are not usable", async () => {
    let calls = 0;
    const results = await runPreflight(
      {},
      {
        fetch: async (...args) => (
          (calls += 1),
          nodeAnswering(healthy)(...args)
        ),
        readFile: async () => code,
      },
      policy,
    );
    expect(calls).toBe(0);
    expect(results.map(({ verdict }) => verdict)).toEqual([
      "fail",
      "fail",
      "skipped",
      "skipped",
      "skipped",
    ]);
    expect(exitCodeOf(results)).toBe(1);
  });

  it("fails when the code on disk is not the release, and quotes the rate without pricing it", async () => {
    const results = await runPreflight(
      env,
      { ...platform(healthy), readFile: async () => new Uint8Array([1]) },
      policy,
    );
    expect(results[1]?.verdict).toBe("fail");
    expect(results[4]?.verdict).toBe("unverified");
  });
});

describe("the report", () => {
  it("shows each check with its verdict and detail", () => {
    const text = formatReport([
      { detail: "fine", name: "A", verdict: "pass" },
      { detail: "not asked", name: "B", verdict: "unverified" },
    ]);
    expect(text).toContain("PASS       A\n           fine");
    expect(text).toContain("UNVERIFIED B");
  });

  it("exits zero only when everything passed, one for any failure, two when only unverified", () => {
    const r = (verdict: "pass" | "fail" | "unverified" | "skipped") => ({
      detail: "",
      name: "",
      verdict,
    });
    expect(exitCodeOf([r("pass")])).toBe(0);
    expect(exitCodeOf([r("pass"), r("unverified")])).toBe(2);
    expect(exitCodeOf([r("unverified"), r("fail")])).toBe(1);
    expect(exitCodeOf([r("skipped")])).toBe(1);
  });

  it("shows a thrown value as text", () => {
    expect(messageOf(new Error("x"))).toBe("x");
    expect(messageOf("y")).toBe("y");
  });
});
