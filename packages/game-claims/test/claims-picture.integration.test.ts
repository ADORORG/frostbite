import { eq } from "drizzle-orm";
import { gameMilestoneClaims } from "@frostbite/database";
import { describe, expect, it } from "vitest";

import {
  chain,
  chainAvailable,
  collectible,
  contract,
  database,
  drawing,
  item,
  otherChain,
  network,
  player,
  registerDatabase,
  seedUser,
  service,
  startAndSign,
} from "./support/fixture.ts";

registerDatabase();

const preview =
  (over: Record<string, unknown> = {}) =>
  async () => ({
    bytes: drawing,
    contentType: "image/svg+xml",
    edition: 7,
    issuer: contract,
    ...over,
  });
const stored = async (id: string) =>
  (
    await database
      .select()
      .from(gameMilestoneClaims)
      .where(eq(gameMilestoneClaims.id, id))
  )[0]?.collectibleId;

// Takes a claim to confirmed (the network shows it included), and on to complete when `finish` is set.
async function claim(userId: string, finish = true) {
  const { claim: started, signed } = await startAndSign(userId);
  await service.submitSigned({ claimId: started.id, signed, userId });
  network.controls.advance(chain, 3);
  await service.refresh(userId, started.id);
  if (finish) await service.refresh(userId, started.id);
  return started.id;
}

describe("the item a claim minted", () => {
  it("is recorded when the network shows the transaction included, and kept as the claim completes", async () => {
    collectible.created = item;
    const userId = await player();
    const id = await claim(userId, false);
    expect(await stored(id)).toBe(item);
    await service.refresh(userId, id);
    expect(await stored(id)).toBe(item);
  });

  it("is not invented when the network names no item", async () => {
    const userId = await player();
    expect(await stored(await claim(userId))).toBeNull();
  });
});

describe("the picture of a minted milestone", () => {
  it("is what the chain serves for the minted item, with its edition", async () => {
    collectible.created = item;
    collectible.preview = preview();
    const userId = await player();
    const id = await claim(userId);
    expect(await service.picture(userId, id)).toEqual({
      bytes: drawing,
      contentType: "image/svg+xml",
      edition: 7,
      ok: true,
    });
  });

  it("asks the chain about the item the claim minted, on the claim's chain", async () => {
    collectible.created = item;
    const asked: unknown[] = [];
    collectible.preview = async (...args) => {
      asked.push(args);
      return preview()();
    };
    const userId = await player();
    await service.picture(userId, await claim(userId));
    expect(asked).toHaveLength(1);
  });

  it("is none for a claim that is not the player's, exactly as for one that does not exist", async () => {
    collectible.created = item;
    collectible.preview = preview();
    const id = await claim(await player());
    const stranger = await seedUser();
    expect(await service.picture(stranger, id)).toEqual({
      code: "not-found",
      ok: false,
    });
  });

  it("is none until the claim is complete, and when no item was recorded", async () => {
    collectible.created = item;
    collectible.preview = preview();
    const userId = await player();
    expect(await service.picture(userId, await claim(userId, false))).toEqual({
      code: "no-picture",
      ok: false,
    });
    collectible.created = null;
    const other = await player();
    expect(await service.picture(other, await claim(other))).toEqual({
      code: "no-picture",
      ok: false,
    });
  });

  it.each([
    [
      "an item issued by another contract",
      { issuer: { ...contract, id: "other" } },
    ],
    [
      "an item issued on another family",
      { issuer: { ...contract, family: "other" } },
    ],
    [
      "an item issued on another chain",
      { issuer: { ...contract, chain: otherChain } },
    ],
    ["a kind of picture that is not shown", { contentType: "text/html" }],
  ])("is none for %s", async (_name, over) => {
    collectible.created = item;
    collectible.preview = preview(over);
    const userId = await player();
    expect(await service.picture(userId, await claim(userId))).toEqual({
      code: "no-picture",
      ok: false,
    });
  });

  it("is none when the chain has no such item", async () => {
    collectible.created = item;
    collectible.preview = async () => null;
    const userId = await player();
    expect((await service.picture(userId, await claim(userId))).ok).toBe(false);
  });

  it("says the chain is unavailable, and not that there is no picture, when it cannot be asked", async () => {
    collectible.created = item;
    collectible.preview = async () => {
      throw new Error("the node is down");
    };
    const userId = await player();
    const id = await claim(userId);
    expect(await service.picture(userId, id)).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    chainAvailable.value = false;
    expect(await service.picture(userId, id)).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
  });
});
