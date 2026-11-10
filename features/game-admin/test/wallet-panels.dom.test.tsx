import { button, click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

const wallet = vi.hoisted(() => ({
  current: { address: "", sign: undefined } as {
    address: string;
    sign: ((transaction: object) => Promise<object | null>) | undefined;
  },
  allowed: [] as (readonly string[])[],
}));
vi.mock("@frostbite/wallet/client", () => ({
  useStepWallet: (allowed: readonly string[]) => {
    wallet.allowed.push(allowed);
    return wallet.current;
  },
}));

import { fieldByLabel } from "@frostbite/test-kit/dom";
import {
  WalletGamePanel,
  WalletTemplatesPanel,
} from "../src/ui/wallet-panels.tsx";
import { fakeApi, publishing } from "./support/fake-api.ts";
import { info } from "./support/fixtures.ts";

const arcade = () => {
  const found = info()[0];
  if (found === undefined) throw new Error("no game");
  return found;
};

describe("the panels over the connected wallet", () => {
  it("offer the connected wallet's address as the one to sign with, and say the wallet will ask for approval", async () => {
    wallet.current = {
      address: "sim:one:a1b2c3fe",
      sign: vi.fn(async (transaction) => transaction),
    };
    const container = await mount(
      <WalletGamePanel
        api={fakeApi()}
        game={arcade()}
        signingWallets={["xverse", "oyl"]}
      />,
    );
    await settle(() =>
      expect(
        container.querySelector('[data-testid="wallet-signs"]'),
      ).not.toBeNull(),
    );
    // The connected wallet is the one signing: shown short, with the whole address in its title, and no field asking for one.
    expect(
      container.querySelector(".signer-bar code")?.getAttribute("title"),
    ).toBe("sim:one:a1b2c3fe");
    expect(container.querySelector(".signer-bar input")).toBeNull();
    expect(wallet.allowed.at(-1)).toEqual(["xverse", "oyl"]);
  });

  it("say no wallet signs, and leave the address to be typed, while none that may sign is connected", async () => {
    wallet.current = { address: "", sign: undefined };
    const container = await mount(
      <WalletTemplatesPanel api={fakeApi()} signingWallets={["xverse"]} />,
    );
    await settle(() =>
      expect(
        container.querySelector('[data-template="game-rewards@1.0.0"]'),
      ).not.toBeNull(),
    );
    expect(
      container.querySelector('[data-testid="wallet-does-not-sign"]')
        ?.textContent,
    ).toContain("No wallet that signs steps is connected");
    expect(
      (fieldByLabel(container, "Wallet address") as HTMLInputElement).value,
    ).toBe("");
  });

  it("sign a step with the connected wallet when the Sign button is pressed", async () => {
    const sign = vi.fn(async (transaction: object) => transaction);
    wallet.current = { address: "sim:one:a1b2c3fe", sign };
    const api = fakeApi({
      templates: vi.fn(async () => ({
        publishable: [{ id: "game-rewards", version: "1.0.0" }],
        published: [],
        steps: [publishing()],
      })),
    });
    const container = await mount(
      <WalletTemplatesPanel api={api} signingWallets={["xverse"]} />,
    );
    await settle(() => expect(textOf(container)).toContain("Details"));
    await click(button(container, "Details"));
    await click(button(container, "Sign with your wallet"));
    expect(sign).toHaveBeenCalledOnce();
    expect(api.submit).toHaveBeenCalledOnce();
  });
});
