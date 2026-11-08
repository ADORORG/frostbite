// @vitest-environment jsdom

import { defineShareConfig, shareControlCopy } from "@frostbite/share";
import {
  click,
  installDialogShim,
  mount,
  settle,
  textOf,
} from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import type { SharesApi } from "../src/client/shares-api.ts";
import { createGameCatalog } from "../src/domain/catalog.ts";
import { shareCopy } from "../src/domain/share-copy.ts";
import { MyMilestones } from "../src/ui/my-milestones.tsx";
import { chains, rewardsGame } from "./support/template-game.ts";

installDialogShim();
const games = createGameCatalog([rewardsGame], chains).list();
const milestone = rewardsGame.milestones[0];
const mint = {
  claimId: "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a",
  gameId: rewardsGame.id,
  milestoneId: milestone?.id ?? "",
  mintedAt: "2026-10-17T12:34:56.000Z",
  transactionId: "ab".repeat(32),
};
const config = defineShareConfig({
  hashtags: [],
  platforms: [
    {
      accent: "#000000",
      id: "x",
      label: "X",
      mark: "X",
      template: "https://x.example/post?text={text}&url={url}",
    },
  ],
});
const shared = (path = "/s/abc") =>
  vi.fn<SharesApi["create"]>(async () => ({ id: "x", path, status: "shared" }));

const show = (
  minted: (typeof mint)[],
  create: SharesApi["create"],
  withConfig = true,
) =>
  mount(
    <MyMilestones
      api={{ list: async () => ({ minted }) }}
      explorerTxUrl="https://explorer.test/tx/{id}"
      games={games}
      navigation={[]}
      sharesApi={{ create }}
      {...(withConfig ? { share: config } : {})}
    />,
  );
const shareTrigger = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLButtonElement>("button.share-trigger")][0] ??
  null;

describe("sharing from the minted milestones page", () => {
  it("shares the shelf: makes the link only when asked, and posts the shelf's words with a link on this site", async () => {
    const create = shared();
    const container = await show([mint], create);
    await settle(() => expect(shareTrigger(container)).not.toBeNull());
    expect(create).not.toHaveBeenCalled();
    click(shareTrigger(container));
    await settle(() =>
      expect(container.querySelector("a.share-tile")).not.toBeNull(),
    );
    expect(create).toHaveBeenCalledExactlyOnceWith({ kind: "milestones" });
    const href = (container.querySelector("a.share-tile") as HTMLAnchorElement)
      .href;
    const post = new URL(href).searchParams;
    expect(post.get("text")).toBe(shareCopy.post.collection);
    expect(post.get("url")).toBe(`${window.location.origin}/s/abc`);
  });

  it("shares one milestone from its close-up, naming the game and the milestone and nothing of the player", async () => {
    const create = shared("/s/piece");
    const container = await show([mint], create);
    await settle(() =>
      expect(container.querySelector(".trophy__button")).not.toBeNull(),
    );
    click(container.querySelector(".trophy__button"));
    // The page's own Share sheet is a dialog too, so the close-up is the one that holds the piece's details.
    const closeUp = () =>
      [...container.querySelectorAll("dialog")].find((candidate) =>
        candidate.querySelector(".trophy-detail"),
      );
    await settle(() => expect(closeUp()?.hasAttribute("open")).toBe(true));
    const dialog = closeUp() as HTMLElement;
    // The button sits on the picture's corner: it is inside the art, so the close-up grows no taller for it.
    const trigger = dialog.querySelector<HTMLButtonElement>(
      ".trophy-detail__art .share-trigger",
    );
    expect(trigger?.getAttribute("aria-label")).toBe(shareControlCopy.button);
    click(trigger);
    await settle(() =>
      expect(dialog.querySelector("a.share-tile")).not.toBeNull(),
    );
    expect(create).toHaveBeenCalledExactlyOnceWith({
      gameId: rewardsGame.id,
      kind: "milestone",
      milestoneId: milestone?.id,
    });
    const post = new URL(
      (dialog.querySelector("a.share-tile") as HTMLAnchorElement).href,
    ).searchParams;
    expect(post.get("text")).toBe(
      shareCopy.post.milestone(milestone?.title ?? "", rewardsGame.title),
    );
    expect(post.get("text")).not.toContain(mint.transactionId);
  });

  it("says so when the link could not be made", async () => {
    const container = await show(
      [mint],
      vi.fn(async () => ({
        reason: "not-earned" as const,
        status: "unavailable" as const,
      })),
    );
    await settle(() => expect(shareTrigger(container)).not.toBeNull());
    click(shareTrigger(container));
    await settle(() =>
      expect(textOf(container)).toContain(shareControlCopy.linkFailed),
    );
  });

  it("offers no share without a configuration, and none for a shelf with nothing on it", async () => {
    const without = await show([mint], shared(), false);
    await settle(() => expect(textOf(without)).toContain(rewardsGame.title));
    expect(shareTrigger(without)).toBeNull();
    const empty = await show([], shared());
    await settle(() => expect(textOf(empty)).not.toContain("Loading"));
    expect(shareTrigger(empty)).toBeNull();
  });
});
