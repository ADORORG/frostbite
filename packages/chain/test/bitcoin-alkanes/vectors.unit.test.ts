import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  collectibleOpcodes,
  gameRewardsOpcodes,
} from "../../src/bitcoin-alkanes/abi.ts";
import { holderHalves } from "../../src/bitcoin-alkanes/holder.ts";
import { milestoneKey } from "../../src/bitcoin-alkanes/milestone-key.ts";

// The contract templates publish their interface and test vectors as JSON; the Rust side and this side are both tested
// against the same files, so neither can drift from the other unnoticed.
function templateFile(name: string) {
  const path = fileURLToPath(
    new URL(`../../../../contracts/templates/abi/${name}`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, "utf8")) as {
    readonly operations?: readonly {
      readonly name: string;
      readonly opcode: number;
    }[];
    readonly vectors?: readonly Record<string, string>[];
  };
}

function camel(name: string): string {
  return name.replace(/_([a-z])/gu, (_, letter: string) =>
    letter.toUpperCase(),
  );
}

function opcodesOf(file: string): Record<string, bigint> {
  return Object.fromEntries(
    (templateFile(file).operations ?? []).map(({ name, opcode }) => [
      camel(name),
      BigInt(opcode),
    ]),
  );
}

describe("the template ABI files", () => {
  it("agree with the opcodes the adapter sends to game-rewards", () => {
    expect(opcodesOf("game-rewards@1.json")).toEqual(gameRewardsOpcodes);
  });

  it("agree with the collectible opcodes the adapter reads", () => {
    const published = opcodesOf("milestone-collectible@1.json");
    for (const [name, opcode] of Object.entries(collectibleOpcodes)) {
      expect(published[name], name).toBe(opcode);
    }
  });
});

describe("shared test vectors", () => {
  it("give every milestone id the key the contracts use", () => {
    const vectors = templateFile("milestone-key-vectors.json").vectors ?? [];
    expect(vectors.length).toBeGreaterThanOrEqual(4);
    for (const { id, key } of vectors) {
      expect(milestoneKey(id ?? ""), id).toBe(BigInt(key ?? ""));
    }
  });

  it("give every address the holder halves the contracts count claims for", () => {
    const vectors = templateFile("holder-vectors.json").vectors ?? [];
    expect(vectors.length).toBeGreaterThanOrEqual(1);
    for (const { address, network, first, second } of vectors) {
      expect(network).toBe("mainnet");
      expect(holderHalves(address ?? "", "mainnet")).toEqual([
        BigInt(first ?? ""),
        BigInt(second ?? ""),
      ]);
    }
  });

  it("find no holder for text that is not a supported address", () => {
    expect(holderHalves("not an address", "mainnet")).toBeNull();
    expect(
      holderHalves("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", "mainnet"),
    ).toBeNull();
  });
});
