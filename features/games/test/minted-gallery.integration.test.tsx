// @vitest-environment jsdom

import { galleryPictureHref } from "@frostbite/shared/games";
import { click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import type { GalleryApi } from "../src/client/gallery-api.ts";
import { createGameCatalog } from "../src/domain/catalog.ts";
import { galleryCopy } from "../src/domain/gallery-copy.ts";
import { shareCopy } from "../src/domain/share-copy.ts";
import { MintedGallery } from "../src/ui/minted-gallery.tsx";
import { chains, rewardsGame } from "./support/template-game.ts";

const game = createGameCatalog([rewardsGame], chains).list()[0];
if (game === undefined) throw new Error("no game");
const [first, second] = rewardsGame.milestones;
const mint = (
  at: number,
  milestoneId = first?.id ?? "",
  verification: "replay-verified" | "self-reported" = "replay-verified",
) => ({
  claimId: `0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f0${String(at)}`,
  milestoneId,
  mintedAt: "2026-10-17T12:00:00.000Z",
  transactionId: "ab".repeat(32),
  verification,
  wallet: "tb1pj0…mhkvgx",
});
const show = (list: GalleryApi["list"]) =>
  mount(
    <MintedGallery
      api={{ list }}
      explorerTxUrl="https://explorer.test/tx/{id}"
      game={game}
    />,
  );

describe("a game's gallery of mints", () => {
  it("says it is loading, then shows the counts of each milestone, most minted first, and each mint with its picture, its short wallet and how it was known", async () => {
    let answer: (page: never) => void = () => undefined;
    const container = await show(
      () => new Promise((resolve) => (answer = resolve as never)),
    );
    expect(textOf(container)).toContain(galleryCopy.loading);
    answer({
      counts: [
        { count: 2, milestoneId: first?.id },
        { count: 40, milestoneId: second?.id },
      ],
      mints: [mint(1), mint(2, second?.id, "self-reported")],
      next: null,
    } as never);
    await settle(() =>
      expect(container.querySelector(".mint-gallery__grid")).not.toBeNull(),
    );
    const counts = [
      ...container.querySelectorAll(".mint-gallery__counts li"),
    ].map((item) => item.textContent);
    expect(counts).toEqual([
      `${second?.title}${galleryCopy.minted(40)}`,
      `${first?.title}${galleryCopy.minted(2)}`,
    ]);
    const cards = [...container.querySelectorAll(".mint-gallery-card")];
    expect(cards).toHaveLength(2);
    expect(textOf(cards[0] as HTMLElement)).toContain(
      galleryCopy.mintedTo("tb1pj0…mhkvgx"),
    );
    expect(textOf(cards[0] as HTMLElement)).toContain(shareCopy.verification);
    // A mint the game reported says nothing about how it is known.
    expect(textOf(cards[1] as HTMLElement)).not.toContain(
      shareCopy.verification,
    );
    expect(textOf(cards[1] as HTMLElement).toLowerCase()).not.toContain(
      "self-reported",
    );
    expect(cards[1]?.querySelector(".mint-gallery-card__level")).toBeNull();
    expect(cards[0]?.querySelector("img")?.getAttribute("src")).toBe(
      galleryPictureHref(mint(1).claimId),
    );
    expect(
      cards[0]?.querySelector<HTMLAnchorElement>(
        `a[href="https://explorer.test/tx/${"ab".repeat(32)}"]`,
      ),
    ).not.toBeNull();
    // It never says who holds a mint now, nor names a player.
    expect(textOf(container)).not.toMatch(/owned by|owner/iu);
    expect(container.querySelector(".mint-gallery__more")).toBeNull();
  });

  it("shows more a page at a time: the next page is added to the list, and a failure to get it says so and can be tried again", async () => {
    const list = vi
      .fn<GalleryApi["list"]>()
      .mockResolvedValueOnce({
        counts: [],
        mints: [mint(1)],
        next: "2026-10-16T00:00:00.000Z_0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f01",
      })
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ counts: null, mints: [mint(2)], next: null });
    const container = await show(list);
    await settle(() =>
      expect(container.querySelectorAll(".mint-gallery-card")).toHaveLength(1),
    );
    const more = () =>
      container.querySelector<HTMLButtonElement>(".mint-gallery__more button");
    click(more());
    await settle(() =>
      expect(textOf(container)).toContain(galleryCopy.loadMoreFailed),
    );
    expect(container.querySelectorAll(".mint-gallery-card")).toHaveLength(1);
    click(more());
    await settle(() =>
      expect(container.querySelectorAll(".mint-gallery-card")).toHaveLength(2),
    );
    expect(list).toHaveBeenLastCalledWith(
      game.id,
      "2026-10-16T00:00:00.000Z_0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f01",
    );
    expect(container.querySelector(".mint-gallery__more")).toBeNull();
  });

  it("invites the first mint when nobody has minted, and says so when the platform cannot be reached", async () => {
    const empty = await show(async () => ({
      counts: [],
      mints: [],
      next: null,
    }));
    await settle(() => expect(textOf(empty)).toContain(galleryCopy.empty));
    expect(empty.querySelector(".mint-gallery__counts")).toBeNull();
    const failing = await show(async () => Promise.reject(new Error("down")));
    await settle(() =>
      expect(failing.querySelector('[role="alert"]')?.textContent).toBe(
        galleryCopy.failed,
      ),
    );
  });
});
