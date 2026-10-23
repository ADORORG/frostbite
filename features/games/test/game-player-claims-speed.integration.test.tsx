// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  flush,
  harness as h,
  registerHarness,
  send,
} from "./support/player-harness.tsx";
import {
  earned,
  fakeApi,
  fees,
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

describe("choosing how fast a claim confirms", () => {
  it("offers the fee speeds beside the milestones, starts on the usual one, and starts the claim at the one chosen", async () => {
    const api = fakeApi();
    await earned({ api, fees, wallet });
    await vi.waitFor(() =>
      expect(document.querySelectorAll("input[type=radio]")).toHaveLength(4),
    );
    const radios = [
      ...document.querySelectorAll<HTMLInputElement>("input[type=radio]"),
    ];
    expect(radios.map((radio) => [radio.value, radio.checked])).toEqual([
      ["slow", true],
      ["medium", false],
      ["fast", false],
      ["lightning", false],
    ]);
    expect(text()).toContain("≈ 202 sats");
    await act(async () => radios[3]?.click());
    await click("Claim ");
    await flush();
    expect(api.start).toHaveBeenCalledExactlyOnceWith({
      feeSpeed: "lightning",
      gameId: "embedded-game",
      milestoneId,
      wallet: wallet.address,
    });
  });

  it("starts a claim the game asks for at the speed the player chose, which the game can neither see nor change", async () => {
    const api = fakeApi();
    const { target } = await earned({ api, fees, wallet });
    await vi.waitFor(() =>
      expect(document.querySelectorAll("input[type=radio]")).toHaveLength(4),
    );
    const radios = [
      ...document.querySelectorAll<HTMLInputElement>("input[type=radio]"),
    ];
    await act(async () => radios[2]?.click());
    send(target, "milestones.claim", { id: milestoneId }, "c");
    await flush();
    expect(api.start).toHaveBeenCalledExactlyOnceWith({
      feeSpeed: "fast",
      gameId: "embedded-game",
      milestoneId,
      wallet: wallet.address,
    });
  });
});
