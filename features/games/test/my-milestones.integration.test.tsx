// @vitest-environment jsdom

import { ApiError } from "@ador/client-http";
import { mount, settle, textOf } from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import type { MintedApi } from "../src/client/minted-api.ts";
import { createGameCatalog } from "../src/domain/catalog.ts";
import { mintedCopy } from "../src/domain/minted-copy.ts";
import { MyMilestones } from "../src/ui/my-milestones.tsx";
import { chains, rewardsGame } from "./support/template-game.ts";

const games = createGameCatalog([rewardsGame], chains).list();
const txId = "ab".repeat(32);
const milestone = rewardsGame.milestones[0];
const mint = {
  claimId: "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a",
  gameId: rewardsGame.id,
  milestoneId: milestone?.id ?? "",
  mintedAt: "2026-10-17T12:34:56.000Z",
  transactionId: txId,
};
const show = (
  list: MintedApi["list"],
  picture: MintedApi["picture"] = async () => ({
    reason: "no-picture",
    status: "unavailable",
  }),
) =>
  mount(
    <MyMilestones
      api={{ list, picture }}
      explorerTxUrl="https://explorer.test/tx/{id}"
      games={games}
      navigation={[]}
    />,
  );

describe("the player's minted milestones page", () => {
  it("says it is loading until the platform answers, then lists each mint with its date and a link to its transaction", async () => {
    let answer: (value: { minted: (typeof mint)[] }) => void = () => undefined;
    const container = await show(
      () => new Promise((resolve) => (answer = resolve)),
    );
    expect(textOf(container)).toContain(mintedCopy.loading);
    answer({ minted: [mint] });
    await settle(() => expect(textOf(container)).toContain(milestone?.title));
    expect(textOf(container)).toContain("2026-10-17 12:34 UTC");
    expect(textOf(container)).not.toContain(mintedCopy.loading);
    expect(
      container.querySelector<HTMLAnchorElement>(`a[href$="${txId}"]`)?.href,
    ).toBe(`https://explorer.test/tx/${txId}`);
    expect(
      container.querySelector<HTMLAnchorElement>(
        `a[href="/games/${rewardsGame.id}"]`,
      ),
    ).not.toBeNull();
  });

  it("says nothing has been minted, rather than showing an empty list", async () => {
    const container = await show(async () => ({ minted: [] }));
    await settle(() => expect(textOf(container)).toContain(mintedCopy.empty));
    expect(container.querySelector("ul")).toBeNull();
  });

  it("offers sign-in, and lists nothing, when the session has ended", async () => {
    const container = await show(async () => {
      throw new ApiError("unauthorized", 401, "no");
    });
    await settle(() =>
      expect(textOf(container)).toContain(mintedCopy.signedOut),
    );
    expect(
      container.querySelector<HTMLAnchorElement>('a[href^="/sign-in"]'),
    ).not.toBeNull();
    expect(textOf(container)).not.toContain(mintedCopy.failed);
  });

  it("says it could not load, rather than that nothing was minted, when the platform cannot be reached", async () => {
    const list = vi.fn(async () => {
      throw new ApiError("network", null, "down");
    });
    const container = await show(list);
    await settle(() => expect(textOf(container)).toContain(mintedCopy.failed));
    expect(textOf(container)).not.toContain(mintedCopy.empty);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("shows the picture the platform has for a mint, asked for by its claim, and none where there is none", async () => {
    const picture = vi.fn<MintedApi["picture"]>(async () => ({
      contentType: "image/svg+xml",
      data: "PHN2Zz48L3N2Zz4=",
      edition: 3,
      status: "ok",
    }));
    const container = await show(async () => ({ minted: [mint] }), picture);
    await settle(() => expect(container.querySelector("img")).not.toBeNull());
    expect(picture).toHaveBeenCalledWith(mint.claimId);
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe(
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    );
    expect(image?.getAttribute("alt")).toBe(milestone?.title);
  });

  it("shows no image, and still the mint, when the picture cannot be had", async () => {
    const refused = await show(async () => ({ minted: [mint] }));
    await settle(() => expect(textOf(refused)).toContain(milestone?.title));
    expect(refused.querySelector("img")).toBeNull();
    const failing = await show(
      async () => ({ minted: [mint] }),
      async () => {
        throw new ApiError("network", null, "down");
      },
    );
    await settle(() => expect(textOf(failing)).toContain(milestone?.title));
    expect(failing.querySelector("img")).toBeNull();
  });
});
