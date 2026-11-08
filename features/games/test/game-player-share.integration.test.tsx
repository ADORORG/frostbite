// @vitest-environment jsdom

import { defineShareConfig, shareControlCopy } from "@frostbite/share";
import type { AccountPort } from "@frostbite/game-sdk/synced-backend";
import { click } from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import type { SharesApi } from "../src/client/shares-api.ts";
import {
  flush,
  game,
  harness as h,
  mount,
  registerHarness,
  send,
} from "./support/player-harness.tsx";

registerHarness();

const playerId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
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
const accountWith = (best: number, milestones: string[] = []): AccountPort => ({
  sync: async () => ({
    kind: "synced",
    playerId,
    state: {
      counters: [],
      milestones: milestones.map((id) => ({
        count: 1,
        id,
        unlockedAt: "2026-10-01T00:00:00.000Z",
        verification: "self-reported" as const,
      })),
      progress: { savedAt: "2026-10-02T00:00:00.000Z", state: { best } },
    },
  }),
});
const api = (): SharesApi => ({
  create: vi.fn(async () => ({
    id: "x",
    path: "/s/x",
    status: "shared" as const,
  })),
});
const chip = () =>
  h.container.querySelector<HTMLButtonElement>(
    ".arcade-stage__bar-end .share-trigger",
  );
async function play(account: AccountPort, saves: number[], extra = {}) {
  const sharing = api();
  const { target } = await mount(() => account, {
    share: config,
    sharesApi: sharing,
    ...extra,
  });
  send(target, "ready", { sdkVersion: 1 });
  send(target, "progress.load", {}, "load");
  await flush();
  for (const [at, best] of saves.entries()) {
    send(target, "progress.save", { state: { best } }, `save-${String(at)}`);
    await flush();
  }
  return sharing;
}

describe("sharing a new best from the game's bar", () => {
  it("offers a Share chip when a run beats the best the game loaded, and shares that score as the player's own report", async () => {
    const sharing = await play(accountWith(100), [250]);
    expect(chip()).not.toBeNull();
    expect(chip()?.textContent).toBe(shareControlCopy.button);
    click(chip());
    await flush();
    expect(sharing.create).toHaveBeenCalledExactlyOnceWith({
      gameId: game.id,
      kind: "score",
      score: 250,
    });
    expect(h.container.textContent).toContain("250");
  });

  it("offers nothing for a run that does not beat the best, and keeps the chip on the best when a later run falls short", async () => {
    await play(accountWith(100), [100, 60]);
    expect(chip()).toBeNull();
    await play(accountWith(100), [300, 150]);
    expect(chip()).not.toBeNull();
  });

  it("offers nothing to a player with no account, or when sharing is not configured", async () => {
    await play({ sync: async () => ({ kind: "signed-out" }) }, [999]);
    expect(chip()).toBeNull();
    const sharing = api();
    const { target } = await mount(() => accountWith(0), {
      sharesApi: sharing,
    });
    send(target, "ready", { sdkVersion: 1 });
    send(target, "progress.load", {}, "load");
    send(target, "progress.save", { state: { best: 50 } }, "save");
    await flush();
    expect(chip()).toBeNull();
  });
});

describe("sharing a milestone from its card", () => {
  const earned = game.milestones[0]?.id ?? "";

  const open = async (account: AccountPort, extra = {}) => {
    const sharing = api();
    await mount(() => account, { share: config, sharesApi: sharing, ...extra });
    await flush();
    click(
      [...h.container.querySelectorAll("button")].find((button) =>
        button.textContent?.startsWith("Milestones"),
      ) ?? null,
    );
    await flush();
    return sharing;
  };
  const cardShare = (id: string) =>
    h.container.querySelector<HTMLButtonElement>(
      `li[data-milestone="${id}"] .milestone-share .share-trigger`,
    );

  it("puts a Share chip on a milestone the player holds, and not on one they do not", async () => {
    const sharing = await open(accountWith(0, [earned]));
    expect(cardShare(earned)).not.toBeNull();
    const other = game.milestones[1]?.id ?? "";
    expect(cardShare(other)).toBeNull();
    click(cardShare(earned));
    await flush();
    expect(sharing.create).toHaveBeenCalledExactlyOnceWith({
      gameId: game.id,
      kind: "milestone",
      milestoneId: earned,
    });
  });

  it("has none without an account or without sharing configured", async () => {
    await open({ sync: async () => ({ kind: "signed-out" }) });
    expect(cardShare(earned)).toBeNull();
    h.root.unmount();
  });
});
