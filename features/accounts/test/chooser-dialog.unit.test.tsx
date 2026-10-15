// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { WalletConnectionClient } from "@ador/wallet/client";
import { beforeAll, expect, it, vi } from "vitest";

import { WalletChooserDialog } from "../src/widget/chooser-dialog.tsx";
import { walletConfig } from "./support/wallet-config.ts";

const state = vi.hoisted(() => ({ chooser: { dismiss: vi.fn(), open: true } }));
vi.mock("@ador/wallet/client", () => ({
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

const render = async (connected: boolean) => {
  const wallet: WalletConnectionClient = {
    address: "",
    connect: async () => undefined,
    connected,
    connecting: false,
    disconnect: () => undefined,
    installationUrl: () => "https://install.example",
    isInstalled: (id) => id === "unisat",
    network: "signet",
    provider: null,
    signMessage: async () => "",
  };
  state.chooser.dismiss.mockClear();
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <WalletChooserDialog
        candidates={walletConfig.candidates}
        wallet={wallet}
      />,
    ),
  );
  return { container, root };
};

it("shows the wallets the platform offers, those found in the browser first, when asked", async () => {
  const { container, root } = await render(false);
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

it("closes itself once a wallet is connected, so the player is back where they were", async () => {
  const { root } = await render(true);
  expect(state.chooser.dismiss).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});

it("stays closed when nobody asked for it", async () => {
  state.chooser.open = false;
  const { container, root } = await render(true);
  expect(container.querySelector("dialog")?.open).toBe(false);
  expect(state.chooser.dismiss).not.toHaveBeenCalled();
  state.chooser.open = true;
  await act(async () => root.unmount());
});
