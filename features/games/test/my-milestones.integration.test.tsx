// @vitest-environment jsdom

import { ApiError } from "@frostbite/client-http";
import { mintedPictureHref, defineGame } from "@frostbite/shared/games";
import { standInInitials } from "@repo/ui/arcade";
import {
  click,
  installDialogShim,
  mount,
  settle,
  textOf,
} from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import type { MintedApi } from "../src/client/minted-api.ts";
import { createGameCatalog } from "../src/domain/catalog.ts";
import { mintedCopy } from "../src/domain/minted-copy.ts";
import { mintedPlaceholderCount } from "../src/domain/minted-view.ts";
import { MyMilestones } from "../src/ui/my-milestones.tsx";
import { chains, coveredGame, rewardsGame } from "./support/template-game.ts";

const other = defineGame({
  ...rewardsGame,
  id: "other-game",
  title: "Other game",
});
const covered = defineGame({ ...rewardsGame, cover: coveredGame.cover });
const games = createGameCatalog([covered, other], chains).list();
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
      `1${mintedCopy.statMilestones(1)}1${mintedCopy.statGames(1)}${mintedCopy.statLatest}${milestone?.title ?? ""}17 Oct 2026`,
    );
    expect(textOf(container)).toContain(mintedCopy.mintedProgress(1, 2));
    // One segment for each milestone of the game, one of them lit.
    const segments = [
      ...(container.querySelector(".shelf__segments")?.children ?? []),
    ];
    expect(segments.map((segment) => segment.getAttribute("data-on"))).toEqual([
      "true",
      "false",
    ]);
  });

  it("fills the places still to earn with locked slots, and keeps games with nothing minted out of the row until asked", async () => {
    const container = await show(async () => ({ minted: [mint] }));
    await settle(() =>
      expect(container.querySelector(".shelf")).not.toBeNull(),
    );
    // Only the picked game's shelf is drawn, with a locked slot for what it still offers and none for what is minted.
    expect(container.querySelectorAll(".shelf")).toHaveLength(1);
    const locked = [...container.querySelectorAll(".trophy--missing")];
    expect(locked.map((slot) => slot.getAttribute("aria-label"))).toEqual([
      mintedCopy.lockedSlot(second?.title ?? ""),
    ]);
    // The other game has nothing minted: it is behind the toggle, not in the row.
    const tiles = () => [...container.querySelectorAll(".rail-game")];
    expect(tiles()).toHaveLength(1);
    const toggle = container.querySelector<HTMLButtonElement>(
      ".rail-games__toggle",
    );
    expect(toggle?.textContent).toBe(mintedCopy.emptyGames(1));
    click(toggle);
    await settle(() => expect(tiles()).toHaveLength(2));
    // Picking it shows its own shelf: nothing minted, everything it offers is in view as places to fill.
    click(tiles()[1] ?? null);
    await settle(() =>
      expect(textOf(container)).toContain(mintedCopy.mintedProgress(0, 2)),
    );
    expect(container.querySelectorAll(".shelf")).toHaveLength(1);
    expect(container.querySelectorAll(".trophy--missing")).toHaveLength(2);
    expect(container.querySelectorAll(".trophy__button")).toHaveLength(0);
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
    expect(dialog.querySelector(".minted-art > img")?.getAttribute("src")).toBe(
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

  it("draws no locked slot, and a full meter, for a game with every milestone minted", async () => {
    const both = rewardsGame.milestones.map((item, at) => ({
      ...mint,
      claimId: `0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f0${String(at)}`,
      milestoneId: item.id,
    }));
    const container = await show(async () => ({ minted: both }));
    await settle(() =>
      expect(container.querySelectorAll(".trophy__button")).toHaveLength(2),
    );
    const shelf = container.querySelector(".shelf") as HTMLElement;
    expect(shelf.querySelector(".trophy--missing")).toBeNull();
    expect(textOf(shelf)).toContain(mintedCopy.mintedProgress(2, 2));
    expect(
      [...shelf.querySelectorAll(".shelf__segments span")].every(
        (segment) => segment.getAttribute("data-on") === "true",
      ),
    ).toBe(true);
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

  it("points each piece's image at the picture's address, holds a medallion in its place until it has come, and shows the picture then", async () => {
    const container = await show(async () => ({ minted: [mint] }));
    await settle(() => expect(container.querySelector("img")).not.toBeNull());
    const image = container.querySelector(".shelf .minted-art > img");
    expect(image?.getAttribute("src")).toBe(mintedPictureHref(mint.claimId));
    expect(image?.getAttribute("alt")).toBe(milestone?.title);
    const art = () => container.querySelector(".minted-art");
    expect(art()?.getAttribute("data-picture")).toBe("loading");
    expect(art()?.querySelector(".medallion")).not.toBeNull();
    image?.dispatchEvent(new Event("load"));
    await settle(() =>
      expect(art()?.getAttribute("data-picture")).toBe("ready"),
    );
    expect(art()?.querySelector(".medallion")).toBeNull();
    expect(art()?.querySelector("img")).not.toBeNull();
  });

  it("keeps a mint without a picture a trophy: the medallion with the game's cover and the milestone's initials, no error on the piece, and the dialog says it is a stand-in", async () => {
    const container = await show(async () => ({ minted: [mint] }));
    await settle(() => expect(container.querySelector("img")).not.toBeNull());
    container
      .querySelector(".shelf .minted-art > img")
      ?.dispatchEvent(new Event("error"));
    await settle(() =>
      expect(
        container.querySelector(".minted-art")?.getAttribute("data-picture"),
      ).toBe("none"),
    );
    expect(container.querySelector(".minted-art > img")).toBeNull();
    const medallion = container.querySelector(".medallion");
    expect(medallion?.querySelector(".medallion__badge")?.textContent).toBe(
      standInInitials(milestone?.title ?? ""),
    );
    expect(
      medallion?.querySelector(".medallion__cover")?.getAttribute("src"),
    ).toBe(games[0]?.cover?.image);
    expect(textOf(container)).toContain(milestone?.title);
    // Nothing on the piece calls it a failure; only the detail view explains.
    expect(textOf(container)).not.toContain(mintedCopy.standIn);
    // The detail view asks for the picture itself (the browser answers from what it kept) and explains the stand-in once told there is none.
    click(piece(container));
    const dialog = () => container.querySelector("dialog") as HTMLElement;
    await settle(() =>
      expect(dialog().querySelector(".minted-art > img")).not.toBeNull(),
    );
    expect(textOf(dialog())).not.toContain(mintedCopy.standIn);
    dialog()
      .querySelector(".minted-art > img")
      ?.dispatchEvent(new Event("error"));
    await settle(() => expect(textOf(dialog())).toContain(mintedCopy.standIn));
  });
});
