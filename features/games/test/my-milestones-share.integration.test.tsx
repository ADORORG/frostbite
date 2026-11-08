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
      id: "x",
      label: "X",
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
  [...root.querySelectorAll("button")].find(
    (b) => b.textContent === shareControlCopy.button,
  ) ?? null;

describe("sharing from the minted milestones page", () => {
  it("shares the shelf: makes the link only when asked, and posts the shelf's words with a link on this site", async () => {
    const create = shared();
    const container = await show([mint], create);
    await settle(() => expect(shareTrigger(container)).not.toBeNull());
    expect(create).not.toHaveBeenCalled();
    click(shareTrigger(container));
    await settle(() =>
      expect(container.querySelector(".menu-list a")).not.toBeNull(),
    );
    expect(create).toHaveBeenCalledExactlyOnceWith({ kind: "milestones" });
    const href = (container.querySelector(".menu-list a") as HTMLAnchorElement)
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
    const dialog =
      (await settle(() =>
        expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(
          true,
        ),
      ),
      container.querySelector("dialog") as HTMLElement);
    click(shareTrigger(dialog));
    await settle(() =>
      expect(dialog.querySelector(".menu-list a")).not.toBeNull(),
    );
    expect(create).toHaveBeenCalledExactlyOnceWith({
      gameId: rewardsGame.id,
      kind: "milestone",
      milestoneId: milestone?.id,
    });
    const post = new URL(
      (dialog.querySelector(".menu-list a") as HTMLAnchorElement).href,
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
