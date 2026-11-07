import {
  button,
  click,
  mount,
  settle,
  textOf,
  unmountAll,
} from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { MintFigures, MintFiguresBoundary } from "../src/ui/mint-figures.tsx";
import { MintsSection } from "../src/ui/mints-section.tsx";
import { apiError, fakeApi } from "./support/fake-api.ts";

const id = (n: number) => `0198a000-0000-7000-8000-00000000000${String(n)}`;
const mint = (n: number, fee = "1500") => ({
  claimId: id(n),
  completedAt: `2026-10-16T1${String(n)}:00:00.000Z`,
  milestoneId: `milestone-${String(n)}`,
  platformFeeUnits: fee,
  transactionId: "ab".repeat(16),
  wallet: "sim:one:a1b2c3fe",
});
const totals = { completed: 12, feesAccruedUnits: "18000", inProgress: 2 };
const cursor = `2026-10-16T12:00:00.000Z~${id(2)}`;

describe("a game's mints and fees", () => {
  it("show the totals and the newest mints, each with its milestone, a shortened wallet and its fee", async () => {
    const api = fakeApi({
      mints: vi.fn(async () => ({
        mints: [mint(2), mint(1, "0")],
        next: null,
        totals,
      })),
    });
    const container = await mount(<MintsSection api={api} gameId="arcade" />);
    await settle(() => expect(textOf(container)).toContain("18,000 sats"));
    const figures = container.querySelector('[aria-label="Mint totals"]');
    expect(figures?.textContent).toContain("Minted12");
    expect(figures?.textContent).toContain("On their way2");
    const rows = [
      ...container.querySelectorAll('[aria-label="Latest mints"] li'),
    ];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("milestone-2");
    expect(rows[0]?.textContent).toContain("1,500 sats");
    expect(rows[0]?.querySelector("[title]")?.getAttribute("title")).toBe(
      "sim:one:a1b2c3fe",
    );
    expect(rows[1]?.textContent).toContain("no fee");
    expect(button(container, "Show older mints")).toBeNull();
  });

  it("say so when nothing has been minted, and offer no list", async () => {
    const container = await mount(
      <MintsSection api={fakeApi()} gameId="arcade" />,
    );
    await settle(() =>
      expect(textOf(container)).toContain("No milestone has been minted"),
    );
    expect(container.querySelector('[aria-label="Latest mints"]')).toBeNull();
  });

  it("load older mints after the cursor the last page gave, and add them below", async () => {
    const mints = vi.fn(async (_game: string, after?: string) =>
      after === undefined
        ? { mints: [mint(2)], next: cursor, totals }
        : { mints: [mint(1)], next: null, totals },
    );
    const container = await mount(
      <MintsSection api={fakeApi({ mints })} gameId="arcade" />,
    );
    await settle(() => expect(textOf(container)).toContain("milestone-2"));
    await click(button(container, "Show older mints"));
    await settle(() => expect(textOf(container)).toContain("milestone-1"));
    expect(mints).toHaveBeenLastCalledWith("arcade", cursor);
    expect(
      container.querySelectorAll('[aria-label="Latest mints"] li'),
    ).toHaveLength(2);
    expect(textOf(container)).toContain("milestone-2");
    expect(button(container, "Show older mints")).toBeNull();
  });

  it("tell staff when the mints could not be loaded, and show no totals that were not read", async () => {
    const api = fakeApi({
      mints: vi.fn(async () => {
        throw apiError("network");
      }),
    });
    const container = await mount(<MintsSection api={api} gameId="arcade" />);
    await settle(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "could not be loaded",
      ),
    );
    expect(container.querySelector('[aria-label="Mint totals"]')).toBeNull();
  });
});

describe("the figures on a game's tile", () => {
  it("read every game's totals once and show each game its own", async () => {
    const api = fakeApi({
      mintTotals: vi.fn(async () => ({
        games: [
          {
            completed: 12,
            feesAccruedUnits: "18000",
            gameId: "arcade",
            inProgress: 0,
          },
          {
            completed: 0,
            feesAccruedUnits: "0",
            gameId: "quiet",
            inProgress: 0,
          },
        ],
      })),
    });
    const container = await mount(
      <MintFiguresBoundary api={api}>
        <div data-testid="arcade">
          <MintFigures gameId="arcade" />
        </div>
        <div data-testid="quiet">
          <MintFigures gameId="quiet" />
        </div>
        <div data-testid="other">
          <MintFigures gameId="other" />
        </div>
      </MintFiguresBoundary>,
    );
    await settle(() =>
      expect(textOf(container)).toContain("12 minted · 18,000 sats in fees"),
    );
    expect(container.querySelector('[data-testid="quiet"]')?.textContent).toBe(
      "0 minted · 0 sats in fees",
    );
    expect(container.querySelector('[data-testid="other"]')?.textContent).toBe(
      "",
    );
    expect(api.mintTotals).toHaveBeenCalledTimes(1);
  });

  it("ignore an answer that arrives after the page is gone", async () => {
    let answer: (rows: { games: never[] }) => void = () => undefined;
    const api = fakeApi({
      mintTotals: vi.fn(
        () =>
          new Promise<{ games: never[] }>((resolve) => {
            answer = resolve;
          }),
      ),
    });
    const container = await mount(
      <MintFiguresBoundary api={api}>
        <MintFigures gameId="arcade" />
      </MintFiguresBoundary>,
    );
    await unmountAll();
    answer({ games: [] });
    await settle(() => expect(api.mintTotals).toHaveBeenCalledTimes(1));
    expect(textOf(container)).toBe("");
  });

  it("show nothing, rather than wrong figures, when the totals could not be read", async () => {
    const api = fakeApi({
      mintTotals: vi.fn(async () => {
        throw apiError("network");
      }),
    });
    const container = await mount(
      <MintFiguresBoundary api={api}>
        <MintFigures gameId="arcade" />
      </MintFiguresBoundary>,
    );
    await settle(() => expect(api.mintTotals).toHaveBeenCalled());
    expect(textOf(container)).toBe("");
  });
});
