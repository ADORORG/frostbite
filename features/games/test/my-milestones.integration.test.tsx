// @vitest-environment jsdom

import { ApiError } from "@ador/client-http";
import { mintedPictureHref } from "@ador/shared/games";
import { mount, settle, textOf } from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import type { MintedApi } from "../src/client/minted-api.ts";
import { createGameCatalog } from "../src/domain/catalog.ts";
import { mintedCopy } from "../src/domain/minted-copy.ts";
import { mintedPlaceholderCount } from "../src/domain/minted-view.ts";
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
const show = (list: MintedApi["list"]) =>
  mount(<MyMilestones api={{ list }} games={games} navigation={[]} />);

describe("the player's minted milestones page", () => {
  it("holds the shape of a collection while it loads, then shows each mint as a card to its game with the day, and no transaction", async () => {
    let answer: (value: { minted: (typeof mint)[] }) => void = () => undefined;
    const container = await show(
      () => new Promise((resolve) => (answer = resolve)),
    );
    expect(textOf(container)).toContain(mintedCopy.loading);
    expect(container.querySelectorAll(".minted-waiting")).toHaveLength(
      mintedPlaceholderCount,
    );
    // The empty places are for the eye only: a screen reader hears the loading lamp, not a list of nothing.
    expect(
      container.querySelector(".minted-waiting")?.closest("ul")?.ariaHidden,
    ).toBe("true");
    answer({ minted: [mint] });
    await settle(() => expect(textOf(container)).toContain(milestone?.title));
    expect(container.querySelector(".minted-waiting")).toBeNull();
    expect(textOf(container)).toContain(mintedCopy.minted("17 Oct 2026"));
    expect(textOf(container)).toContain(rewardsGame.title);
    expect(textOf(container)).not.toContain(mintedCopy.loading);
    expect(container.innerHTML).not.toContain(txId);
    // A square, whatever the picture is, so a card is the same size before and after it arrives.
    expect(
      container.querySelector(".cover-card")?.getAttribute("data-ratio"),
    ).toBe("square");
    const links = container.querySelectorAll<HTMLAnchorElement>(
      `a[href="/games/${rewardsGame.id}"]`,
    );
    expect(links.length).toBeGreaterThan(0);
  });

  it("says nothing has been minted, rather than showing an empty list", async () => {
    const container = await show(async () => ({ minted: [] }));
    await settle(() => expect(textOf(container)).toContain(mintedCopy.empty));
    expect(container.querySelector(".cover-grid")).toBeNull();
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

  it("points each card's image at the picture's address, keeps the stand-in until it has come, and shows it then", async () => {
    const container = await show(async () => ({ minted: [mint] }));
    await settle(() => expect(container.querySelector("img")).not.toBeNull());
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe(mintedPictureHref(mint.claimId));
    expect(image?.getAttribute("alt")).toBe(milestone?.title);
    const art = () => container.querySelector(".minted-art");
    expect(art()?.getAttribute("data-picture")).toBe("loading");
    expect(art()?.querySelector(".arcade-preview")).not.toBeNull();
    expect(textOf(container)).not.toContain(mintedCopy.noPicture);
    image?.dispatchEvent(new Event("load"));
    await settle(() =>
      expect(art()?.getAttribute("data-picture")).toBe("ready"),
    );
    expect(art()?.querySelector(".arcade-preview")).toBeNull();
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("keeps the picture's place with a stand-in that says so when the picture cannot be had, and still shows the mint", async () => {
    const container = await show(async () => ({ minted: [mint] }));
    await settle(() => expect(container.querySelector("img")).not.toBeNull());
    container.querySelector("img")?.dispatchEvent(new Event("error"));
    await settle(() =>
      expect(textOf(container)).toContain(mintedCopy.noPicture),
    );
    expect(textOf(container)).toContain(milestone?.title);
    expect(container.querySelector("img")).toBeNull();
    expect(
      container.querySelector(".minted-art .arcade-preview"),
    ).not.toBeNull();
    expect(
      container.querySelector(".minted-art")?.getAttribute("data-picture"),
    ).toBe("none");
  });
});
