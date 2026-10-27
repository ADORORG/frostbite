// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  flush,
  harness as h,
  registerHarness,
  rerender,
} from "./support/player-harness.tsx";
import {
  claimAt,
  claimGame,
  earned,
  fakeApi,
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
const dialog = () =>
  h.container.querySelector<HTMLDialogElement>("dialog.arcade-modal");

const start = async (over: Parameters<typeof earned>[0]) => {
  await earned(over);
  await click("Claim ");
  await flush();
};

describe("the claim review", () => {
  it("opens in a dialog of its own, over the dock and the stage, and closes with its button", async () => {
    await start({ api: fakeApi(), wallet });
    const open = dialog();
    expect(open?.hasAttribute("open")).toBe(true);
    expect(open?.querySelector('[data-testid="claim-review"]')).not.toBeNull();
    // Not inside the dock panel it was started from, nor the stage's overlay, where the dock covers it.
    expect(open?.closest(".arcade-dock, .arcade-stage")).toBeNull();
    await act(async () =>
      open
        ?.querySelector<HTMLButtonElement>(".arcade-modal__header button")
        ?.click(),
    );
    expect(dialog()?.hasAttribute("open")).toBe(false);
    expect(dialog()?.querySelector('[data-testid="claim-review"]')).toBeNull();
  });

  it("keeps what the platform built behind Details, and the fee and the one button in view", async () => {
    await start({ api: fakeApi(), sign: async (t) => t, wallet });
    const review = dialog()?.querySelector('[data-testid="claim-review"]');
    expect(review?.querySelector(".network-fee")?.textContent).toContain(
      "12 sim",
    );
    const details = review?.querySelector("details");
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain("rewards-1");
    expect(
      details?.querySelector('[title="' + wallet.address + '"]'),
    ).not.toBeNull();
    expect(dialog()?.querySelector(".arcade-modal__footer")?.textContent).toBe(
      "Sign with your wallet",
    );
  });

  it("says a connected wallet that cannot sign claims cannot, and no wallet at all is to be connected", async () => {
    await start({ api: fakeApi(), wallet });
    expect(text()).toContain("wallet you connected cannot sign claims");
    await rerender({
      claims: { api: fakeApi(), wallet: null },
      game: claimGame,
    });
    expect(text()).not.toContain("wallet you connected cannot sign claims");
    expect(dialog()?.textContent).toContain("Connect a wallet to claim.");
  });

  it("says the wallet's own words when it declines, sends nothing, and lets the player try again", async () => {
    const api = fakeApi();
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const sign = vi
      .fn()
      .mockRejectedValueOnce(new Error("User rejected the request"))
      .mockImplementation(async (t: unknown) => t);
    await start({ api, sign, wallet });
    await click("Sign with your wallet");
    expect(dialog()?.textContent).toContain("User rejected the request");
    expect(dialog()?.textContent).toContain("nothing was sent");
    expect(api.submit).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    expect(button("Sign with your wallet")?.hasAttribute("disabled")).toBe(
      false,
    );
    await click("Sign with your wallet");
    expect(api.submit).toHaveBeenCalledTimes(1);
  });

  it("turns the spinner while a sent claim waits on the network, and not once it is over", async () => {
    const api = fakeApi({
      refresh: vi.fn(async () => ({
        claim: claimAt("pending"),
        status: "ok" as const,
      })),
    });
    await start({ api, pollMs: 10_000, sign: async (t) => t, wallet });
    await click("Sign with your wallet");
    expect(dialog()?.querySelector(".spinner")).not.toBeNull();
    expect(dialog()?.textContent).toContain("Sent");
    const done = fakeApi({
      list: vi.fn(async () => ({ claims: [claimAt("complete")] })),
    });
    await rerender({ claims: { api: done, wallet }, game: claimGame });
    await flush();
    await click("Details");
    expect(dialog()?.textContent).toContain("Claimed");
    expect(dialog()?.querySelector(".spinner")).toBeNull();
  });
});
