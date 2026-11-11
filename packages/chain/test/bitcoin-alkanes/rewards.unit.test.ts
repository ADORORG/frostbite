import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";
import {
  chainFamilyIdSchema,
  chainRefSchema,
  type ChainRef,
  type ContractRef,
} from "@frostbite/shared/chain";

import {
  collectibleOpcodes,
  gameRewardsOpcodes,
} from "../../src/bitcoin-alkanes/abi.ts";
import { milestoneKey } from "../../src/bitcoin-alkanes/milestone-key.ts";
import type { AlkaneId } from "../../src/bitcoin-alkanes/node/alkane-id.ts";
import type { AlkanesNode } from "../../src/bitcoin-alkanes/node/node.ts";
import { fakeNode } from "../support/nodes.ts";
import type { ViewResult } from "../../src/bitcoin-alkanes/node/messages.ts";
import {
  ContractAnswerError,
  createRewardsReader,
} from "../../src/bitcoin-alkanes/rewards.ts";

const chain: ChainRef = chainRefSchema.parse(
  "bip122:000000000019d6689c085ae165831e93",
);
const family = chainFamilyIdSchema.parse("bitcoin-alkanes");
const game: ContractRef = { chain, family, id: "2:5" };
const wallet = { chain, value: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4" };
const text = (value: string): ViewResult => ({
  data: new TextEncoder().encode(value),
  fuelUsed: 0n,
  ok: true,
});
const number = (value: bigint): ViewResult => {
  const bytes = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1)
    bytes[index] = Number((value >> BigInt(8 * index)) & 0xffn);
  return { data: bytes, fuelUsed: 0n, ok: true };
};
const failure: ViewResult = { error: "ALKANES: revert", ok: false };

interface Seen {
  readonly inputs: readonly bigint[];
  readonly opcode: bigint;
  readonly target: AlkaneId;
}

function nodeAnswering(answer: (call: Seen) => ViewResult) {
  const calls: Seen[] = [];
  const node = fakeNode({
    view: (target, opcode, inputs) => {
      calls.push({ inputs, opcode, target });
      return Promise.resolve(answer({ inputs, opcode, target }));
    },
  });
  return { calls, node };
}

const reader = (node: AlkanesNode, maxPreviewBytes = 1000) =>
  createRewardsReader({
    chains: new Map([[chain, { network: "mainnet" as const, node }]]),
    maxPreviewBytes,
  });

describe("claimed", () => {
  it("asks the game for the holder's count of the milestone", async () => {
    const { calls, node } = nodeAnswering(() => number(3n));
    expect(await reader(node).claimed(game, wallet, "first-frost")).toBe(3);
    expect(calls).toEqual([
      {
        inputs: [
          97762100933704329355157203268016748680n,
          199570462015842529564996467312406190929n,
          milestoneKey("first-frost"),
        ],
        opcode: gameRewardsOpcodes.getClaimed,
        target: { block: 2n, tx: 5n },
      },
    ]);
  });

  it("refuses a holder on another chain, an unsupported address and an id that is not an Alkane", async () => {
    const { node } = nodeAnswering(() => number(0n));
    const claims = reader(node);
    const other = chainRefSchema.parse("bip122:other");
    await expect(
      claims.claimed(game, { chain: other, value: wallet.value }, "m-1"),
    ).rejects.toThrow("another chain");
    await expect(
      claims.claimed(game, { chain, value: "nope" }, "m-1"),
    ).rejects.toThrow("supported address");
    await expect(
      claims.claimed({ ...game, id: "rewards-1" }, wallet, "m-1"),
    ).rejects.toThrow("not an Alkane id");
    await expect(
      claims.claimed({ ...game, chain: other }, wallet, "m-1"),
    ).rejects.toThrow("not served");
  });

  it("surfaces a revert and refuses a count that is not sixteen bytes or too large", async () => {
    await expect(
      reader(nodeAnswering(() => failure).node).claimed(game, wallet, "m-1"),
    ).rejects.toBeInstanceOf(ContractAnswerError);
    await expect(
      reader(nodeAnswering(() => text("x")).node).claimed(game, wallet, "m-1"),
    ).rejects.toThrow("sixteen");
    await expect(
      reader(nodeAnswering(() => number(1n << 60n)).node).claimed(
        game,
        wallet,
        "m-1",
      ),
    ).rejects.toThrow("safe integer");
  });
});

describe("claimed at the edge of a safe count", () => {
  const largestSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const claims = (value: bigint) =>
    reader(nodeAnswering(() => number(value)).node).claimed(
      game,
      wallet,
      "m-1",
    );

  it("accepts the largest safe count and refuses the next", async () => {
    expect(await claims(largestSafe)).toBe(Number.MAX_SAFE_INTEGER);
    await expect(claims(largestSafe + 1n)).rejects.toThrow("safe integer");
  });
});

describe("drawing", () => {
  it("asks the game for the milestone's art by its key, and answers its size and SHA-256", async () => {
    const art = "<svg viewBox='0 0 1 1'/>";
    const { calls, node } = nodeAnswering(() => text(art));
    const held = await reader(node).drawing(game, "first-frost");
    expect(calls).toEqual([
      {
        inputs: [milestoneKey("first-frost")],
        opcode: gameRewardsOpcodes.getMilestoneArt,
        target: { block: 2n, tx: 5n },
      },
    ]);
    expect(held).toEqual({
      bytes: art.length,
      sha256: createHash("sha256").update(art).digest("hex"),
    });
  });

  it("answers none when the game keeps no art for the milestone, and refuses an answer it cannot trust", async () => {
    expect(
      await reader(nodeAnswering(() => text("")).node).drawing(game, "m-1"),
    ).toBeNull();
    await expect(
      reader(nodeAnswering(() => failure).node).drawing(game, "m-1"),
    ).rejects.toBeInstanceOf(ContractAnswerError);
    await expect(
      reader(nodeAnswering(() => text("x")).node).drawing(
        { ...game, id: "rewards-1" },
        "m-1",
      ),
    ).rejects.toBeInstanceOf(ContractAnswerError);
  });
});

describe("preview", () => {
  const attributes = '{"game":"2:5","milestone":"7","serial":3}';
  const item: ContractRef = { chain, family, id: "2:9" };
  const answerItem = ({ opcode }: Seen): ViewResult => {
    if (opcode === collectibleOpcodes.getContentType)
      return text("image/svg+xml");
    if (opcode === collectibleOpcodes.getData) return text("<svg/>");
    return text(attributes);
  };

  it("gives the picture, its type, the issuer and the edition", async () => {
    const { calls, node } = nodeAnswering(answerItem);
    const preview = await reader(node).preview(item);
    expect(preview).toEqual({
      bytes: new TextEncoder().encode("<svg/>"),
      contentType: "image/svg+xml",
      edition: 3,
      issuer: { chain, family, id: "2:5" },
    });
    expect(calls.map(({ opcode }) => opcode)).toEqual([
      collectibleOpcodes.getContentType,
      collectibleOpcodes.getData,
      collectibleOpcodes.getAttributes,
    ]);
  });

  it("is null when there is no such collectible", async () => {
    expect(
      await reader(nodeAnswering(() => failure).node).preview(item),
    ).toBeNull();
  });

  it("refuses a collectible that starts answering and then does not", async () => {
    const answer = ({ opcode }: Seen) =>
      opcode === collectibleOpcodes.getData
        ? failure
        : answerItem({ inputs: [], opcode, target: { block: 0n, tx: 0n } });
    await expect(
      reader(nodeAnswering(answer).node).preview(item),
    ).rejects.toThrow("did not answer");
  });

  it("allows a picture exactly as large as the limit", async () => {
    const preview = await reader(
      nodeAnswering(answerItem).node,
      "<svg/>".length,
    ).preview(item);
    expect(preview?.bytes.length).toBe(6);
  });

  it("refuses a collectible whose attributes fail after its picture answered", async () => {
    const answer = (call: Seen) =>
      call.opcode === collectibleOpcodes.getAttributes
        ? failure
        : answerItem(call);
    await expect(
      reader(nodeAnswering(answer).node).preview(item),
    ).rejects.toThrow("did not answer");
  });

  it("refuses a picture larger than the limit", async () => {
    await expect(
      reader(nodeAnswering(answerItem).node, 5).preview(item),
    ).rejects.toThrow("larger than the preview limit");
  });

  it("refuses malformed attributes", async () => {
    for (const bad of [
      "",
      "{}",
      '{"game":"2:5","milestone":"7","serial":0}',
      '{"game":"x","milestone":"7","serial":1}',
    ]) {
      const answer = (call: Seen) =>
        call.opcode === collectibleOpcodes.getAttributes
          ? text(bad)
          : answerItem(call);
      await expect(
        reader(nodeAnswering(answer).node).preview(item),
        bad,
      ).rejects.toThrow("malformed");
    }
  });

  it("is built with a positive whole limit", () => {
    for (const maxPreviewBytes of [0, -1, 1.5]) {
      expect(() =>
        reader(nodeAnswering(answerItem).node, maxPreviewBytes),
      ).toThrow("preview limit");
    }
  });
});
