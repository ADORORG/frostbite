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
  claimGame,
  earned,
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

describe("when a claim cannot go ahead", () => {
  it.each([
    ["limit-reached", "as often as it allows"],
    ["claims-paused", "Claims are paused for this game"],
    ["milestone-not-defined", "has not been set up on the network yet"],
    ["no-funds", "no confirmed coins to pay the network fee"],
    ["index-behind", "index is behind the chain right now"],
    ["fee-too-high", "Network fees are higher than this platform allows"],
    ["contract-refused", "contract would refuse this claim"],
    ["not-earned", "Earn this milestone first"],
    ["not-supported", "not available for this game yet"],
    ["unavailable", "could not be reached"],
    ["wrong-network", "another network"],
  ] as const)("says why a start was refused: %s", async (reason, copy) => {
    const api = fakeApi({
      start: vi.fn(async () => ({ reason, status: "unavailable" as const })),
    });
    await earned({ api, wallet });
    await click("Claim ");
    await flush();
    expect(text()).toContain(copy);
    expect(review()).toBeNull();
  });

  it("tells the player why when it was the game that asked for the claim and the platform refused it", async () => {
    const api = fakeApi({
      start: vi.fn(async () => ({
        reason: "no-funds" as const,
        status: "unavailable" as const,
      })),
    });
    const { reply, target } = await mount(undefined, {
      claims: { api, wallet },
      game: claimGame,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "milestones.unlock", { id: milestoneId }, "b");
    await flush();
    send(target, "milestones.claim", { id: milestoneId }, "c");
    await flush();
    // The game is given the one word its protocol has; the player is given the reason, on the page.
    expect(
      reply.mock.calls
        .map(([message]) => message as { id?: string; result?: object })
        .find((message) => message.id === "c")?.result,
    ).toEqual({ reason: "unavailable", status: "unavailable" });
    expect(text()).toContain("no confirmed coins to pay the network fee");
  });

  it("asks for a wallet without asking the platform when none is connected", async () => {
    const api = fakeApi();
    await earned({ api, wallet: null });
    await click("Claim ");
    await flush();
    expect(text()).toContain("Connect a wallet to claim.");
    expect(api.start).not.toHaveBeenCalled();
  });

  it("says to sign in when there is no session, and that the platform could not be reached for any other failure", async () => {
    const { ApiError } = await import("@ador/client-http");
    const signedOut = fakeApi({
      start: vi.fn(async () => {
        throw new ApiError("unauthorized", 401, "no");
      }),
    });
    await earned({ api: signedOut, wallet });
    await click("Claim ");
    await flush();
    expect(text()).toContain("Sign in to claim.");
  });

  it("says the platform could not be reached when starting fails", async () => {
    const api = fakeApi({
      start: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    await earned({ api, wallet });
    await click("Claim ");
    await flush();
    expect(text()).toContain(
      "The platform could not be reached. Nothing was changed.",
    );
  });
});
