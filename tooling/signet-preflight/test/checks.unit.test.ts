import { packCode, sha256Hex } from "@ador/chain/bitcoin-alkanes";
import { describe, expect, it } from "vitest";

import { checkConfiguration } from "../src/checks/configuration.ts";
import { checkFee, estimateVbytes } from "../src/checks/fee.ts";
import {
  authTokenFactory,
  checkFactory,
  checkIndexer,
} from "../src/checks/indexer.ts";
import { checkTemplates } from "../src/checks/templates.ts";

const delay = { maxLagBlocks: 2, maxUnsettledMs: 3_600_000 };
const code = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const template = {
  codeHash: sha256Hex(code),
  crate: "game-rewards",
  version: "1.0.0",
};
const base = {
  REWARDS_CHAIN_RPC_URL: "https://node.example",
  REWARDS_MAX_FEE_SATS: "500000",
};

describe("settings", () => {
  it("passes settings the platform would boot with", () => {
    const { environment, result } = checkConfiguration(base);
    expect(result.verdict).toBe("pass");
    expect(environment?.maxFeeSats).toBe(500_000n);
  });

  it("names the node by its host only, since the address may carry a key", () => {
    const { result } = checkConfiguration({
      ...base,
      REWARDS_CHAIN_RPC_URL: "https://node.example/v4/s3cret-key",
    });
    expect(result.detail).toContain("Node node.example,");
    expect(result.detail).not.toContain("s3cret-key");
  });

  it("fails with no node address, and says what that means", () => {
    const { environment, result } = checkConfiguration({});
    expect(environment).toBeNull();
    expect(result.verdict).toBe("fail");
    expect(result.detail).toContain("REWARDS_CHAIN_RPC_URL");
  });

  it("fails with the platform's own refusal for a node address with no fee ceiling", () => {
    const { result } = checkConfiguration({
      REWARDS_CHAIN_RPC_URL: base.REWARDS_CHAIN_RPC_URL,
    });
    expect(result.verdict).toBe("fail");
    expect(result.detail).toContain("REWARDS_MAX_FEE_SATS");
  });
});

describe("template code", () => {
  it("passes code with the released hash and reports its packed size", async () => {
    const { found, result } = await checkTemplates(
      "/dir",
      [template],
      async () => code,
    );
    expect(result.verdict).toBe("pass");
    expect(found).toEqual([
      { crate: "game-rewards", packedBytes: packCode(code).length },
    ]);
  });

  it("fails code that is not the release, and names the file", async () => {
    const { found, result } = await checkTemplates(
      "/dir",
      [template],
      async () => new Uint8Array([1]),
    );
    expect(result.verdict).toBe("fail");
    expect(result.detail).toContain("/dir/game-rewards.wasm");
    expect(found).toEqual([]);
  });

  it("fails a file that cannot be read, and an unset directory", async () => {
    const missing = await checkTemplates("/dir", [template], async () => {
      throw new Error("ENOENT");
    });
    expect(missing.result).toMatchObject({ verdict: "fail" });
    expect(missing.result.detail).toContain("ENOENT");
    const unset = await checkTemplates(null, [template], async () => code);
    expect(unset.result.verdict).toBe("fail");
  });

  it("fails when only one of two templates is wrong", async () => {
    const other = { ...template, crate: "milestone-collectible" };
    const { found, result } = await checkTemplates(
      "/d",
      [template, other],
      async (path) =>
        path.endsWith("milestone-collectible.wasm")
          ? new Uint8Array([9])
          : code,
    );
    expect(result.verdict).toBe("fail");
    expect(found.map(({ crate }) => crate)).toEqual(["game-rewards"]);
  });
});

describe("the indexer and the factory", () => {
  const node = (indexed: number, tip: number) => ({
    indexedHeight: async () => indexed,
    tip: async () => ({ hash: "00", height: tip }),
  });

  it("passes an indexer within the allowed lag and fails one beyond it", async () => {
    expect((await checkIndexer(node(98, 100), delay)).verdict).toBe("pass");
    const stalled = await checkIndexer(node(97, 100), delay);
    expect(stalled.verdict).toBe("fail");
    expect(stalled.detail).toContain("3 behind");
  });

  it("does not claim anything where the node cannot be asked", async () => {
    const down = {
      indexedHeight: async (): Promise<number> => {
        throw new Error("no backend in sync");
      },
      tip: async () => ({ hash: "00", height: 1 }),
    };
    const result = await checkIndexer(down, delay);
    expect(result.verdict).toBe("unverified");
    expect(result.detail).toContain("no backend in sync");
  });

  it("finds the factory by the id the game template calls", async () => {
    const asked: string[] = [];
    const result = await checkFactory(
      {
        bytecode: async (id) => {
          asked.push(`${id.block}:${id.tx}`);
          return new Uint8Array(12);
        },
      },
      authTokenFactory,
    );
    expect(asked).toEqual(["4:65517"]);
    expect(result).toMatchObject({ verdict: "pass" });
    expect(result.detail).toContain("12 bytes");
  });

  it("fails where nothing is deployed, and is unverified where the read fails", async () => {
    expect(
      (await checkFactory({ bytecode: async () => null }, authTokenFactory))
        .verdict,
    ).toBe("fail");
    const refused = await checkFactory(
      {
        bytecode: async () => {
          throw new Error("no backend in sync");
        },
      },
      authTokenFactory,
    );
    expect(refused.verdict).toBe("unverified");
  });
});

describe("the fee", () => {
  const found = [{ crate: "game-rewards", packedBytes: 4_000 }];
  const rate = (value: number) => ({ feeRate: async () => value });

  it("prices the packed code at a quarter weight plus framing", () => {
    expect(estimateVbytes(4_000)).toBe(1_400);
  });

  it("passes at the ceiling and fails one satoshi over", async () => {
    expect((await checkFee(rate(2), 3, 2_800n, found)).verdict).toBe("pass");
    const over = await checkFee(rate(2), 3, 2_799n, found);
    expect(over.verdict).toBe("fail");
    expect(over.detail).toContain("game-rewards about 2800 sats");
  });

  it("asks for the policy's target and shows the rate it was quoted", async () => {
    const targets: number[] = [];
    const result = await checkFee(
      { feeRate: async (target) => (targets.push(target), 75) },
      3,
      1_000_000n,
      found,
    );
    expect(targets).toEqual([3]);
    expect(result.detail).toContain("75 sat/vB");
  });

  it("does not claim anything when no rate arrives, or when there is no code to price", async () => {
    const down = await checkFee(
      {
        feeRate: async () => {
          throw new Error("no estimate");
        },
      },
      3,
      1n,
      found,
    );
    expect(down.verdict).toBe("unverified");
    const unpriced = await checkFee(rate(75), 3, 1n, []);
    expect(unpriced.verdict).toBe("unverified");
    expect(unpriced.detail).toContain("75 sat/vB");
  });
});
