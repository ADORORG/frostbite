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

const chip = () => document.querySelector<HTMLButtonElement>(".fee-chip");
// The speed is one small control; its tiles open under it.
const openedRadios = async () => {
  await vi.waitFor(() => expect(chip()?.textContent).toContain("1.01"));
  await act(async () =>
    chip()?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  return [...document.querySelectorAll<HTMLInputElement>("input[type=radio]")];
};

describe("choosing how fast a claim confirms", () => {
  it("offers the fee speeds beside the milestones, starts on the usual one, and starts the claim at the one chosen", async () => {
    const api = fakeApi();
    await earned({ api, fees, wallet });
    expect(document.querySelector("input[type=radio]")).toBeNull();
    const radios = await openedRadios();
    expect(radios).toHaveLength(4);
    expect(radios.map((radio) => [radio.value, radio.checked])).toEqual([
      ["slow", true],
      ["medium", false],
      ["fast", false],
      ["lightning", false],
    ]);
    // No size is known before the claim is built, so no cost is told, only the rate and the wait.
    expect(text()).toContain("1.01 sat/vB");
    expect(text()).not.toContain("≈");
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
    const radios = await openedRadios();
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
