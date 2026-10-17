// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  flush,
  harness as h,
  mount,
  registerHarness,
  send,
} from "./support/player-harness.tsx";
import {
  claimAt,
  claimGame,
  fakeApi,
  milestoneId,
  wallet,
} from "./support/claims-ui.tsx";

registerHarness();

const text = () => h.container.textContent;
const button = (name: string) =>
  [...h.container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent.includes(name),
  );
const click = (name: string) =>
  act(async () => {
    button(name)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const review = () => h.container.querySelector('[data-testid="claim-review"]');
const answer = (reply: { mock: { calls: unknown[][] } }, id: string) =>
  reply.mock.calls
    .map(([message]) => message)
    .find((message) => (message as { id?: string }).id === id);

describe("a claim the game asks for", () => {
  it("opens the review for the player, and tells the game it was requested", async () => {
    const api = fakeApi();
    const { reply, target } = await mount(undefined, {
      claims: { api, wallet },
      game: claimGame,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "milestones.claim", { id: milestoneId }, "b");
    await flush();
    expect(answer(reply, "b")).toMatchObject({
      ok: true,
      result: { status: "requested" },
    });
    expect(api.start).toHaveBeenCalledExactlyOnceWith({
      gameId: "embedded-game",
      milestoneId,
      wallet: wallet.address,
    });
    expect(review()?.getAttribute("data-state")).toBe("awaiting-signature");
  });

  it("answers the game that there is no wallet, and shows the player nothing", async () => {
    const api = fakeApi();
    const { reply, target } = await mount(undefined, {
      claims: { api, wallet: null },
      game: claimGame,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "milestones.claim", { id: milestoneId }, "b");
    await flush();
    expect(answer(reply, "b")).toMatchObject({
      result: { reason: "no-wallet", status: "unavailable" },
    });
    expect(review()).toBeNull();
    expect(api.start).not.toHaveBeenCalled();
  });
});

describe("the claims section of the dock", () => {
  it("lists the claims already on the account, without telling the game of them", async () => {
    // The claims arrive after the game is ready, so a game that was told would hear it.
    let arrive: () => void = () => undefined;
    const api = fakeApi({
      list: vi.fn(
        () =>
          new Promise<{ claims: ReturnType<typeof claimAt>[] }>((resolve) => {
            arrive = () => resolve({ claims: [claimAt("complete")] });
          }),
      ),
    });
    const { reply, target } = await mount(undefined, {
      claims: { api, wallet },
      game: claimGame,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    arrive();
    await flush();
    expect(api.list).toHaveBeenCalledExactlyOnceWith("embedded-game");
    expect(text()).toContain("Your claims");
    expect(text()).toContain("Claimed");
    expect(
      reply.mock.calls.filter(
        ([message]) =>
          (message as { event?: string }).event === "claim.changed",
      ),
    ).toEqual([]);
  });

  it("says nothing was claimed when nothing was, and that the player pays the fee", async () => {
    await mount(undefined, {
      claims: { api: fakeApi(), wallet },
      game: claimGame,
    });
    await flush();
    expect(text()).toContain("You have not claimed anything from this game.");
    expect(text()).toContain(
      "complete only when the network's records show it",
    );
  });

  it("opens the details of a claim again after they were closed", async () => {
    const api = fakeApi({
      list: vi.fn(async () => ({ claims: [claimAt("pending")] })),
    });
    await mount(undefined, {
      claims: { api, pollMs: 100_000, wallet },
      game: claimGame,
    });
    await flush();
    expect(review()).toBeNull();
    await click("Details");
    expect(review()?.getAttribute("data-state")).toBe("pending");
    // Sent already: there is nothing left for the wallet to sign.
    expect(button("Sign with your wallet")).toBeUndefined();
    await click("Close");
    expect(review()).toBeNull();
  });

  it("keeps going when the claims cannot be listed or looked at", async () => {
    const api = fakeApi({
      list: vi.fn(async () => {
        throw new Error("offline");
      }),
      refresh: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    await mount(undefined, {
      claims: { api, pollMs: 10, wallet },
      game: claimGame,
    });
    await flush();
    expect(text()).toContain("You have not claimed anything from this game.");
  });

  it("is not on a game whose milestones cannot be claimed", async () => {
    await mount(undefined, { game: claimGame });
    await flush();
    expect(text()).not.toContain("Your claims");
    expect(button("Claim ")).toBeUndefined();
  });
});

describe("a milestone claimed before", () => {
  it("shows the newest claim of it, and offers no second claim while that one is under way", async () => {
    const earlier = claimAt("failed", {
      failureReason: "reverted by the network",
      id: "1b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b61",
    });
    const api = fakeApi({
      list: vi.fn(async () => ({ claims: [earlier, claimAt("pending")] })),
    });
    const { target } = await mount(undefined, {
      claims: { api, pollMs: 100_000, wallet },
      game: claimGame,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "milestones.unlock", { id: milestoneId }, "b");
    await flush();
    expect(text()).toContain("Claim: Sent");
    expect(button("Claim ")).toBeUndefined();
  });
});

describe("a claim that is taking long", () => {
  it("is called delayed beside its milestone and in the list of claims, never failed, and offers no second claim", async () => {
    const api = fakeApi({
      list: vi.fn(async () => ({
        claims: [
          claimAt("pending", {
            delayed: true,
            sentAt: "2026-10-16T11:00:00.000Z",
          }),
        ],
      })),
    });
    const { target } = await mount(undefined, {
      claims: { api, pollMs: 100_000, wallet },
      game: claimGame,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "milestones.unlock", { id: milestoneId }, "b");
    await flush();
    expect(text()).toContain("Claim: Sent, delayed");
    expect(text()).not.toContain("Claim: Sent,\u0020waiting");
    expect(text()).not.toContain("Failed");
    expect(button("Claim ")).toBeUndefined();
    expect(document.querySelector("[data-delayed='true']")).not.toBeNull();
  });
});
