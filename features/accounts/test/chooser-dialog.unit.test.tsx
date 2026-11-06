// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { WalletConnectionClient } from "@frostbite/wallet/client";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";

import { WalletChooserDialog } from "../src/widget/chooser-dialog.tsx";
import { walletConfig } from "./support/wallet-config.ts";

const state = vi.hoisted(() => ({ chooser: { dismiss: vi.fn(), open: true } }));
vi.mock("@frostbite/wallet/client", () => ({
  classifyWalletConnectionError: () => ({ kind: "failed", message: "x" }),
  useWalletChooser: () => state.chooser,
  walletNetworkUnavailableReason: () => null,
}));

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  state.chooser.dismiss.mockClear();
  state.chooser.open = true;
});

const walletOf = (
  overrides: Partial<WalletConnectionClient> = {},
): WalletConnectionClient => ({
  address: "",
  connect: async () => undefined,
  connected: false,
  connecting: false,
  disconnect: () => undefined,
  installationUrl: () => "https://install.example",
  isInstalled: (id) => id === "unisat",
  network: "signet",
  provider: null,
  signMessage: async () => "",
  signPsbt: async () => "",
  ...overrides,
});
const unisat = {
  address: "tb1qaaa",
  connected: true,
  provider: "unisat",
} as const;

async function mount(first: WalletConnectionClient) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const show = (wallet: WalletConnectionClient) =>
    act(async () =>
      root.render(
        <WalletChooserDialog
          candidates={walletConfig.candidates}
          wallet={wallet}
        />,
      ),
    );
  await show(first);
  return { container, root, show };
}

it("shows the wallets the platform offers, those found in the browser first, when asked", async () => {
  const { container, root } = await mount(walletOf());
  expect(container.querySelector("dialog")?.open).toBe(true);
  const tiles = [...container.querySelectorAll(".arcade-wallet-tile")];
  expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual([
    "Connect UniSat",
    "Connect Xverse",
  ]);
  expect(tiles[0]?.textContent).toContain("Detected");
  expect(state.chooser.dismiss).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it("closes itself once a wallet that was not connected when it opened is connected", async () => {
  const { root, show } = await mount(walletOf());
  await show(walletOf({ connecting: true }));
  expect(state.chooser.dismiss).not.toHaveBeenCalled();
  await show(walletOf(unisat));
  expect(state.chooser.dismiss).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});

it("stays open for 'Switch wallet' when a wallet was already connected, and closes when a different one is", async () => {
  const { root, show } = await mount(walletOf(unisat));
  await show(walletOf(unisat));
  expect(state.chooser.dismiss).not.toHaveBeenCalled();
  await show(
    walletOf({ address: "tb1qbbb", connected: true, provider: "xverse" }),
  );
  expect(state.chooser.dismiss).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});

it("closes when the same wallet is chosen again, once connecting has finished", async () => {
  const { root, show } = await mount(walletOf(unisat));
  await show(walletOf({ ...unisat, connecting: true }));
  expect(state.chooser.dismiss).not.toHaveBeenCalled();
  await show(walletOf(unisat));
  expect(state.chooser.dismiss).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});

it("stays closed when nobody asked for it, and forgets what it saw when it is closed and opened again", async () => {
  state.chooser.open = false;
  const { container, root, show } = await mount(walletOf(unisat));
  expect(container.querySelector("dialog")?.open).toBe(false);
  await show(
    walletOf({ address: "tb1qbbb", connected: true, provider: "xverse" }),
  );
  expect(state.chooser.dismiss).not.toHaveBeenCalled();
  // Opened now, with that wallet connected: the same wallet does not close it.
  state.chooser.open = true;
  await show(
    walletOf({ address: "tb1qbbb", connected: true, provider: "xverse" }),
  );
  expect(state.chooser.dismiss).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
