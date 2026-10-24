import { mount, settle, textOf } from "@ador/test-kit/dom";
import { WalletProvider } from "@ador/wallet/client";
import { describe, expect, it } from "vitest";

import { GameSurface, GamesSurface } from "../src/ui/surfaces.tsx";
import { fakeApi } from "./support/fake-api.ts";
import { info } from "./support/fixtures.ts";

const navigation = [] as const;
const signingWallets = ["xverse"] as const;
const fees = { defaultSpeed: "slow", refreshMs: 60_000 } as const;
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
