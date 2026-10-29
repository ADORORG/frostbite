// @vitest-environment jsdom

import { ApiError } from "@ador/client-http";
import { mintedPictureHref, defineGame } from "@ador/shared/games";
import {
  click,
  installDialogShim,
  mount,
  settle,
  textOf,
} from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import type { MintedApi } from "../src/client/minted-api.ts";
import { createGameCatalog } from "../src/domain/catalog.ts";
import { mintedCopy } from "../src/domain/minted-copy.ts";
import { mintedPlaceholderCount } from "../src/domain/minted-view.ts";
import { MyMilestones } from "../src/ui/my-milestones.tsx";
import { chains, rewardsGame } from "./support/template-game.ts";

const other = defineGame({
  ...rewardsGame,
  id: "other-game",
  title: "Other game",
});
const games = createGameCatalog([rewardsGame, other], chains).list();
installDialogShim();
const txId = "ab".repeat(32);
const milestone = rewardsGame.milestones[0];
const mint = {
  claimId: "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a",
  gameId: rewardsGame.id,
  milestoneId: milestone?.id ?? "",
  mintedAt: "2026-10-17T12:34:56.000Z",
  transactionId: txId,
};
const second = rewardsGame.milestones[1];
const show = (list: MintedApi["list"]) =>
  mount(
    <MyMilestones
      api={{ list }}
      explorerTxUrl="https://explorer.test/tx/{id}"
      games={games}
      navigation={[]}
    />,
  );
const piece = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>(".trophy__button");

describe("the player's minted milestones page", () => {
  it("holds the shape of a collection while it loads, then shows each mint as a piece on its game's shelf with the day, and no transaction", async () => {
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
    // A square whatever the picture is, so a place is the same size before and after it arrives.
    expect(container.querySelector(".trophy__art")).not.toBeNull();
    expect(
      container.querySelector(`a[href="/games/${rewardsGame.id}"]`),
    ).not.toBeNull();
  });

  it("says what the collection holds in a few facts, and how much of each game is minted", async () => {
    const container = await show(async () => ({ minted: [mint] }));
    await settle(() =>
      expect(container.querySelector(".shelf")).not.toBeNull(),
    );
    expect(container.querySelector(".shelf-summary")?.textContent).toBe(
      `${mintedCopy.piecesCount(1)} ${mintedCopy.gamesCount(1)}${mintedCopy.firstMinted("17 Oct 2026")}${mintedCopy.latestMinted(milestone?.title ?? "", "17 Oct 2026")}`,
    );
    expect(textOf(container)).toContain(mintedCopy.mintedProgress(1, 2));
    expect(container.querySelector("progress")?.getAttribute("value")).toBe(
      "50",
    );
  });

  it("shows an outline, and no picture, for every milestone not minted, and a shelf for a game with none minted", async () => {
    const container = await show(async () => ({ minted: [mint] }));
    await settle(() =>
      expect(container.querySelector(".shelf")).not.toBeNull(),
    );
    const outline = container.querySelectorAll(".trophy--missing");
    expect(outline.length).toBeGreaterThan(0);
    expect(textOf(outline[0] as HTMLElement)).toContain(second?.title);
    expect(textOf(outline[0] as HTMLElement)).toContain(mintedCopy.notMinted);
    expect(outline[0]?.querySelector("img, button")).toBeNull();
    // The other game that can mint milestones has its own shelf, all outlines.
    expect(container.querySelectorAll(".shelf")).toHaveLength(2);
    expect(textOf(container)).toContain(mintedCopy.mintedProgress(0, 2));
  });

  it("opens a piece up close with what it is, the day and its transaction on the explorer, and closes it", async () => {
    const container = await show(async () => ({ minted: [mint] }));
    await settle(() => expect(piece(container)).not.toBeNull());
    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(false);
    click(piece(container));
    await settle(() =>
      expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(
        true,
      ),
    );
    const dialog = container.querySelector("dialog") as HTMLElement;
    expect(textOf(dialog)).toContain(milestone?.description);
    expect(textOf(dialog)).toContain("17 Oct 2026");
    expect(
      dialog.querySelector<HTMLAnchorElement>(
        `a[href="https://explorer.test/tx/${txId}"]`,
      ),
    ).not.toBeNull();
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe(
      mintedPictureHref(mint.claimId),
    );
    click(
      [...dialog.querySelectorAll("button")].find(
        (b) => b.textContent === "Close",
      ) ?? null,
    );
    await settle(() =>
      expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(
        false,
      ),
    );
  });

  it("ribbons only the first and the newest mint", async () => {
    const middle = {
      ...mint,
      claimId: "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f01",
      mintedAt: "2026-10-18T12:00:00.000Z",
    };
    const newest = {
      ...mint,
      claimId: "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f02",
      mintedAt: "2026-10-19T12:00:00.000Z",
    };
    const container = await show(async () => ({
      minted: [newest, middle, mint],
    }));
    await settle(() =>
      expect(container.querySelectorAll(".trophy__button")).toHaveLength(3),
    );
    expect(
      [...container.querySelectorAll(".trophy__ribbon")].map(
        (ribbon) => ribbon.textContent,
      ),
    ).toEqual([mintedCopy.ribbon.latest, mintedCopy.ribbon.first]);
  });

  it("ribbons the first mint of a game", async () => {
    const container = await show(async () => ({ minted: [mint] }));
    await settle(() =>
      expect(container.querySelector(".trophy__ribbon")).not.toBeNull(),
    );
    expect(textOf(container)).toContain(mintedCopy.ribbon.first);
  });

  it("says nothing has been minted, rather than showing an empty list", async () => {
    const container = await show(async () => ({ minted: [] }));
    await settle(() => expect(textOf(container)).toContain(mintedCopy.empty));
    expect(container.querySelector(".shelf")).toBeNull();
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
    const image = container.querySelector(".shelf img");
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
