import { mount, settle, textOf } from "@frostbite/test-kit/dom";
import { WalletProvider } from "@frostbite/wallet/client";
import { describe, expect, it, vi } from "vitest";

import { GameSurface, GamesSurface } from "../src/ui/surfaces.tsx";
import { fakeApi, listing, step } from "./support/fake-api.ts";
import { info } from "./support/fixtures.ts";

const navigation = [] as const;
const signingWallets = ["xverse"] as const;
const fees = {
  defaultSpeed: "slow",
  polling: { forgetAfterMs: 600_000, refreshMs: 60_000 },
} as const;
// The app's layout provides the wallet connection above every page; a page rendered alone needs the same.
const inApp = (page: React.ReactNode) => (
  <WalletProvider network="signet">{page}</WalletProvider>
);

describe("the staff pages", () => {
  it("list the games that declare rewards with a way in, above the templates", async () => {
    const container = await mount(
      inApp(
        <GamesSurface
          api={fakeApi()}
          explorerTxUrl="https://explorer.test/tx/{id}"
          fees={fees}
          games={info()}
          navigation={navigation}
          signingWallets={signingWallets}
        />,
      ),
    );
    await settle(() =>
      expect(
        container.querySelector('[data-template="game-rewards@1.0.0"]'),
      ).not.toBeNull(),
    );
    expect(
      container.querySelector("a[href='/admin/games/arcade']")?.textContent,
    ).toBe("Administer Arcade");
    // Whether a game has its contract is on record, so the list does not claim to know it.
    expect(textOf(container)).not.toContain("Rewards contract");
  });

  it("say so when no game declares rewards", async () => {
    const container = await mount(
      inApp(
        <GamesSurface
          api={fakeApi()}
          explorerTxUrl="https://explorer.test/tx/{id}"
          fees={fees}
          games={[]}
          navigation={navigation}
          signingWallets={signingWallets}
        />,
      ),
    );
    expect(textOf(container)).toContain("Nothing to administer");
  });

  it("show a game's page with its contract loaded from the record, and 'not found' for a game that declares no rewards", async () => {
    const [arcade] = info();
    const page = await mount(
      inApp(
        <GameSurface
          api={fakeApi()}
          explorerTxUrl="https://explorer.test/tx/{id}"
          fees={fees}
          game={arcade}
          navigation={navigation}
          signingWallets={signingWallets}
        />,
      ),
    );
    expect(textOf(page)).toContain("Rewards on simnet:one.");
    await settle(() =>
      expect(
        page.querySelector('[data-testid="contract-address"]')?.textContent,
      ).toBe("rewards-1"),
    );
    const missing = await mount(
      inApp(
        <GameSurface
          api={fakeApi()}
          explorerTxUrl="https://explorer.test/tx/{id}"
          fees={fees}
          game={undefined}
          navigation={navigation}
          signingWallets={signingWallets}
        />,
      ),
    );
    expect(textOf(missing)).toContain("Game not found");
    expect(missing.querySelector("a[href='/admin/games']")).not.toBeNull();
  });
});

describe("the staff pages, with mints and the platform fee", () => {
  const platform = {
    chains: [
      {
        chain: "simnet:one",
        current: {
          changedAt: "2026-10-16T12:00:00.000Z",
          changedBy: "Ada",
          feeUnits: "1500",
          treasury: "sim:one:7ea5a1ab",
        },
        history: [],
        maximumFeeUnits: "100000",
      },
    ],
  };

  it("show the platform fee above the games, and each game's mints and fees on its tile", async () => {
    const api = fakeApi({
      mintTotals: async () => ({
        games: [
          {
            completed: 12,
            feesAccruedUnits: "18000",
            gameId: "arcade",
            inProgress: 0,
          },
        ],
      }),
      platformFee: async () => platform as never,
    });
    const container = await mount(
      inApp(
        <GamesSurface
          api={api}
          explorerTxUrl="https://explorer.test/tx/{id}"
          fees={fees}
          games={info()}
          navigation={navigation}
          signingWallets={signingWallets}
        />,
      ),
    );
    await settle(() =>
      expect(textOf(container)).toContain("12 minted · 18,000 sats in fees"),
    );
    expect(textOf(container)).toContain("Each claim carries 1,500 sats");
    const order = [...container.querySelectorAll("h2")].map(
      (heading) => heading.textContent,
    );
    expect(order.indexOf("Platform fee")).toBeLessThan(order.indexOf("Games"));
    // The fee and the address it is paid to are one form, side by side.
    expect(
      container.querySelector("form .fee-fields input[inputmode='numeric']"),
    ).not.toBeNull();
  });

  it("show a game's mints and fees on its own page", async () => {
    const [arcade] = info();
    const api = fakeApi({
      mints: vi.fn(async () => ({
        mints: [],
        next: null,
        totals: { completed: 3, feesAccruedUnits: "4500", inProgress: 1 },
      })),
    });
    const page = await mount(
      inApp(
        <GameSurface
          api={api}
          explorerTxUrl="https://explorer.test/tx/{id}"
          fees={fees}
          game={arcade}
          navigation={navigation}
          signingWallets={signingWallets}
        />,
      ),
    );
    await settle(() => expect(textOf(page)).toContain("4,500 sats"));
    expect(textOf(page)).toContain("Mints and fees");
    expect(api.mints).toHaveBeenCalledWith("arcade");
  });

  it("puts a game's mints and activity above its milestones, which come last", async () => {
    const [arcade] = info();
    const api = fakeApi({
      list: vi.fn(async () =>
        listing([step({ state: "complete", toSign: null })]),
      ),
    });
    const page = await mount(
      inApp(
        <GameSurface
          api={api}
          explorerTxUrl="https://explorer.test/tx/{id}"
          fees={fees}
          game={arcade}
          navigation={navigation}
          signingWallets={signingWallets}
        />,
      ),
    );
    await settle(() => expect(textOf(page)).toContain("Milestones"));
    const order = [...page.querySelectorAll("h2")].map(
      (heading) => heading.textContent,
    );
    const at = (title: string) => order.indexOf(title);
    expect(at("Claims")).toBeGreaterThanOrEqual(0);
    expect(at("Claims")).toBeLessThan(at("Mints and fees"));
    expect(at("Mints and fees")).toBeLessThan(at("Activity"));
    expect(at("Activity")).toBeLessThan(at("Milestones"));
    // Milestones scroll in a box of their own, which the keyboard can reach.
    const box = page.querySelector('[aria-label="Milestones of this game"]');
    expect(box?.getAttribute("tabindex")).toBe("0");
    expect(box?.className).toContain("staff-scroll");
    const log = page.querySelector('[aria-label="Activity of this game"]');
    expect(log?.getAttribute("tabindex")).toBe("0");
    expect(log?.className).toContain("staff-scroll");
  });
});
