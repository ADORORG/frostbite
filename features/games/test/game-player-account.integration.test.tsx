// @vitest-environment jsdom

import type { AccountPort } from "@ador/game-sdk/synced-backend";
import { describe, expect, it, vi } from "vitest";

import {
  flush,
  game,
  harness as h,
  mount,
  send,
  registerHarness,
} from "./support/player-harness.tsx";

registerHarness();

const playerId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";

describe("the game player with an account", () => {
  const merged = {
    milestones: [
      {
        id: game.milestones[0]?.id ?? "",
        unlockedAt: "2026-10-01T00:00:00.000Z",
        verification: "self-reported",
      },
    ],
    progress: { savedAt: "2026-10-02T00:00:00.000Z", state: { taps: 7 } },
  } as const;

  it("starts the game from the account's state and says the progress is saved there", async () => {
    const sync = vi.fn<AccountPort["sync"]>(async () => ({
      kind: "synced",
      playerId,
      state: merged,
    }));
    const accountFor = () => ({ sync });
    const { reply, target } = await mount(accountFor);
    send(target, "ready", { sdkVersion: 1 });
    send(target, "progress.load", {}, "r2");
    await flush();
    expect(reply.mock.calls[1]?.[0]).toMatchObject({
      ok: true,
      result: { state: { taps: 7 } },
    });
    expect(h.container.textContent).toContain(
      "Your progress is saved to your account and kept in this browser.",
    );
    expect(h.container.textContent).toContain(
      "Reported by the game on 2026-10-01.",
    );
  });

  it("sends a save made in the game to the account", async () => {
    const sync = vi.fn<AccountPort["sync"]>(async () => ({
      kind: "synced",
      playerId,
      state: merged,
    }));
    const accountFor = () => ({ sync });
    const { target } = await mount(accountFor);
    send(target, "ready", { sdkVersion: 1 });
    send(target, "progress.save", { state: { taps: 8 } }, "r2");
    await flush();
    expect(sync.mock.calls.at(-1)?.[0].progress?.state).toEqual({ taps: 8 });
  });

  it("says saving to the account is waiting when it cannot be reached, and the game still plays", async () => {
    const accountFor = () => ({
      sync: async () => ({ kind: "failed" as const }),
    });
    const { reply, target } = await mount(accountFor);
    send(target, "ready", { sdkVersion: 1 });
    send(target, "progress.save", { state: { taps: 1 } }, "r2");
    await flush();
    expect(reply.mock.calls[1]?.[0]).toMatchObject({ ok: true });
    expect(h.container.textContent).toContain(
      "Saving it to your account is waiting for a connection.",
    );
  });

  it("tells the game the account's id as who the player is, from the first answer", async () => {
    const sync = vi.fn<AccountPort["sync"]>(async () => ({
      kind: "synced",
      playerId,
      state: merged,
    }));
    const { reply, target } = await mount(() => ({ sync }));
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "player.identity", {}, "b");
    await flush();
    expect(
      reply.mock.calls
        .map(([message]) => message)
        .find((message) => (message as { id?: string }).id === "b"),
    ).toMatchObject({ ok: true, result: { id: playerId, kind: "account" } });
  });

  it("tells a game that began with this browser's id when the account's replaces it", async () => {
    let up = false;
    const sync = vi.fn<AccountPort["sync"]>(async () =>
      up ? { kind: "synced", playerId, state: merged } : { kind: "failed" },
    );
    const { reply, target } = await mount(() => ({ sync }));
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "player.identity", {}, "b");
    await flush();
    const answer = (id: string) =>
      reply.mock.calls
        .map(([message]) => message)
        .find((message) => (message as { id?: string }).id === id);
    expect(answer("b")).toMatchObject({ result: { kind: "local" } });
    up = true;
    send(target, "progress.save", { state: { taps: 9 } }, "c");
    await flush();
    const events = reply.mock.calls
      .map(([message]) => message)
      .filter((message) => "event" in (message as object));
    expect(events).toEqual([
      {
        channel: "ador-game",
        data: { id: playerId, kind: "account" },
        event: "player.changed",
        version: 1,
      },
    ]);
  });
});
