import type { ChainIndexing } from "@ador/shared/chain";
import { click, mount, textOf } from "@ador/test-kit/dom";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { NetworkPill } from "../src/ui/network-pill.tsx";
import { answered, distorted, ok } from "./support/fee-fixtures.ts";

const reading: Extract<ChainIndexing, { state: "ok" }> = {
  chain: "Bitcoin testnet4",
  health: "catching-up",
  indexedHeight: 157_400,
  lag: 1,
  observedAt: "2026-10-23T12:00:00.000Z",
  state: "ok",
  tipHeight: 157_401,
};
const pill = (props: Partial<Parameters<typeof NetworkPill>[0]> = {}) => (
  <NetworkPill indexing={reading} market={answered(ok)} {...props} />
);
const trigger = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>("button.network-pill");
const opened = async (node: ReactElement) => {
  const container = await mount(node);
  await click(trigger(container));
  return container;
};

describe("the network pill in the header", () => {
  it("is one small control: a light, the network's name and its latest block, named for what it says", async () => {
    const container = await mount(pill());
    expect(textOf(container)).toBe("testnet4#157,401");
    expect(trigger(container)?.getAttribute("aria-label")).toBe(
      "testnet4, block 157,401: 1 block behind",
    );
    expect(container.querySelector(".popover__panel")).toBeNull();
    expect(container.querySelector(".status-dot--ready")).not.toBeNull();
  });

  it("opens to how far the platform has read the chain, and each speed with its rate and wait, with no cost told for a transaction that does not exist yet", async () => {
    const container = await opened(pill());
    const panel = container.querySelector(".popover__panel");
    expect(panel?.getAttribute("aria-label")).toBe("Chain and fees");
    expect(textOf(container)).toContain("Bitcoin testnet4");
    expect(textOf(container)).toContain("1 block behind");
    expect(textOf(container)).toContain("read to block 157400 of 157401");
    expect(
      container.querySelector("progress")?.getAttribute("aria-label"),
    ).toBe("How far the platform has read the chain");
    expect(container.querySelector("progress")?.value).toBe(100);
    expect(textOf(container)).toContain("What each speed costs");
    const tiles = [...container.querySelectorAll(".segmented__option")].map(
      (tile) => tile.textContent,
    );
    expect(tiles).toEqual([
      "Slow1.01 sat/vBabout 4 h",
      "Medium3.00 sat/vBabout 1 h",
      "Fast5.00 sat/vBabout 30 min",
      "Lightning9.00 sat/vBabout 15 min",
    ]);
    expect(textOf(container)).toContain("Read 12:00:00 UTC");
    expect(textOf(container)).toContain(
      "You see the exact fee before you sign",
    );
  });

  it("marks the speeds no step can afford and says why, while the one that can be chosen stays plain", async () => {
    const container = await opened(pill({ market: answered(distorted) }));
    const tiles = [...container.querySelectorAll(".segmented__option")];
    expect(tiles.map((tile) => tile.getAttribute("data-off"))).toEqual([
      null,
      "true",
      "true",
      "true",
    ]);
    expect(tiles[1]?.textContent).toContain("588,235 sat/vB");
    expect(tiles[1]?.textContent).toContain("Over the limit");
    expect(tiles[0]?.textContent).not.toContain("limit");
    expect(textOf(container)).toContain(
      "more for this speed than the 500,000 sats a step may pay",
    );
  });

  it("says a delay is a delay, in the light's colour and in words", async () => {
    const container = await mount(
      pill({
        indexing: {
          ...reading,
          health: "delayed",
          indexedHeight: 157_390,
          lag: 11,
        },
      }),
    );
    expect(trigger(container)?.getAttribute("aria-label")).toContain(
      "Delayed, 11 blocks behind",
    );
    expect(container.querySelector(".status-dot--attention")).not.toBeNull();
  });

  it("says the status is unknown, and draws no figure, when the platform cannot be reached", async () => {
    const container = await opened(
      pill({ indexing: null, market: { status: "unreachable" } }),
    );
    expect(trigger(container)?.getAttribute("aria-label")).toBe(
      "Chain: Chain status unknown",
    );
    expect(textOf(container)).toContain("Fees unknown right now");
    expect(container.querySelector("progress")).toBeNull();
    expect(container.querySelector(".segmented__option")).toBeNull();
    expect(container.querySelector(".network-pill__block")).toBeNull();
  });

  it("takes the block from the fee reading when the indexer's is not there, and says fees are loading while they are", async () => {
    const fromFees = await mount(
      pill({ indexing: { chain: "Bitcoin testnet4", state: "unavailable" } }),
    );
    expect(textOf(fromFees)).toBe("testnet4#157,401");
    const loading = await opened(pill({ market: { status: "loading" } }));
    expect(textOf(loading)).toContain("Loading what each speed costs");
  });

  it("shows an empty bar for a chain at block zero, not an error", async () => {
    const container = await opened(
      pill({
        indexing: { ...reading, indexedHeight: 0, lag: 0, tipHeight: 0 },
      }),
    );
    expect(container.querySelector("progress")?.value).toBe(0);
    expect(textOf(container)).toContain("0%");
    expect(textOf(container)).not.toContain("NaN");
  });

  it("shows how far the reading has come as a share of the chain, not a rounded-up full bar", async () => {
    const container = await opened(
      pill({
        indexing: {
          ...reading,
          health: "delayed",
          indexedHeight: 150,
          lag: 50,
          tipHeight: 200,
        },
      }),
    );
    expect(container.querySelector("progress")?.value).toBe(75);
    expect(textOf(container)).toContain("read to block 150 of 200");
    expect(textOf(container)).not.toContain("Read to block");
  });

  it("draws nothing where the platform follows no chain", async () => {
    const container = await mount(
      pill({
        indexing: { state: "none" },
        market: answered({ state: "none" }),
      }),
    );
    expect(container.innerHTML).toBe("");
  });
});
