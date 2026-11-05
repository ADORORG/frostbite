// @vitest-environment jsdom

import type { ClaimsService } from "@frostbite/game-sdk/host";
import { describe, expect, it, vi } from "vitest";

import {
  flush,
  game,
  mount,
  registerHarness,
  send,
} from "./support/player-harness.tsx";

registerHarness();

const claimGame = {
  ...game,
  capabilities: ["milestone:claim"],
  milestones: [...game.milestones],
};
const answer = (reply: { mock: { calls: unknown[][] } }, id: string) =>
  reply.mock.calls
    .map(([message]) => message)
    .find((message) => (message as { id?: string }).id === id);
const firstMilestone = game.milestones[0]?.id ?? "";

describe("claims on the game page", () => {
  it("asks the platform to start a claim for a game that declared milestone:claim, and tells the game what it said", async () => {
    const claim = vi.fn<ClaimsService["claim"]>(async () => ({
      status: "requested",
    }));
    const { reply, target } = await mount(undefined, {
      claimsFor: () => ({ claim }),
      game: claimGame,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "milestones.claim", { id: firstMilestone }, "b");
    await flush();
    expect(answer(reply, "b")).toMatchObject({
      ok: true,
      result: { status: "requested" },
    });
    expect(claim).toHaveBeenCalledExactlyOnceWith(firstMilestone);
  });

  it("gives the claims service a way to read the wallet the player has connected right now", async () => {
    let reader: (() => unknown) | undefined;
    const { target } = await mount(undefined, {
      claimsFor: (_gameId, wallet) => {
        reader = wallet;
        return { claim: async () => ({ status: "requested" }) };
      },
      game: claimGame,
      wallet: {
        connect: () => undefined,
        current: { address: "tb1pexampleexampleexample", network: "signet" },
        expectedNetwork: "signet",
      },
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    expect(reader?.()).toEqual({
      address: "tb1pexampleexampleexample",
      network: "signet",
    });
  });

  it("tells a game claims are not supported while the page has nowhere to show a claim", async () => {
    const { reply, target } = await mount(undefined, { game: claimGame });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "milestones.claim", { id: firstMilestone }, "b");
    await flush();
    expect(answer(reply, "b")).toMatchObject({
      ok: true,
      result: { reason: "not-supported", status: "unavailable" },
    });
  });

  it("refuses a game that did not declare milestone:claim, and never asks the platform", async () => {
    const claim = vi.fn<ClaimsService["claim"]>(async () => ({
      status: "requested",
    }));
    const { reply, target } = await mount(undefined, {
      claimsFor: () => ({ claim }),
      game,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "milestones.claim", { id: firstMilestone }, "b");
    await flush();
    expect(answer(reply, "b")).toMatchObject({
      error: { code: "permission_denied" },
      ok: false,
    });
    expect(claim).not.toHaveBeenCalled();
  });
});
