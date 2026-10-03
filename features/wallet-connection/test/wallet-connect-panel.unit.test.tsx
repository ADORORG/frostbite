// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WalletConnectionClient } from "@ador/wallet/client";

const connect = vi.fn<WalletConnectionClient["connect"]>(async () => undefined);
const disconnect = vi.fn();
let client: WalletConnectionClient;

vi.mock("@ador/wallet/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ador/wallet/client")>()),
  useWalletConnection: () => client,
}));

import { WalletConnectPanel } from "../src/ui/wallet-connect-panel.tsx";

const candidates = [{ id: "xverse", label: "Xverse" }] as const;
let container: HTMLDivElement;
let root: Root;

async function render(): Promise<void> {
  await act(async () =>
    root.render(<WalletConnectPanel candidates={candidates} />),
  );
}

function button(): HTMLButtonElement {
  const element =
    container.querySelector("li button") ?? container.querySelector("button");
  if (!(element instanceof HTMLButtonElement))
    throw new Error("Expected button");
  return element;
}

describe("wallet connect panel", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    connect.mockReset();
    connect.mockResolvedValue(undefined);
    disconnect.mockReset();
    client = {
      address: "",
      connect,
      connected: false,
      connecting: false,
      disconnect,
      installationUrl: () => "https://www.xverse.app/",
      isInstalled: () => true,
      network: "signet",
      provider: null,
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("delegates connection to the configured candidate", async () => {
    await render();
    await act(async () => button().click());
    expect(connect).toHaveBeenCalledWith("xverse");
    expect(container.textContent).not.toContain("failed");
  });

  it("opens and closes the native wallet chooser", async () => {
    await render();
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("Expected wallet dialog");
    const showModal = vi.fn();
    const close = vi.fn();
    Object.defineProperty(dialog, "showModal", { value: showModal });
    Object.defineProperty(dialog, "close", { value: close });
    const buttons = container.querySelectorAll("button");
    await act(async () => buttons[0]?.click());
    expect(showModal).toHaveBeenCalledOnce();
    await act(async () => buttons[1]?.click());
    expect(close).toHaveBeenCalledOnce();
  });

  it("explains Phantom's signet limitation without sending users to install", async () => {
    await act(async () =>
      root.render(
        <WalletConnectPanel
          candidates={[{ id: "phantom", label: "Phantom" }]}
        />,
      ),
    );
    expect(button().disabled).toBe(true);
    expect(container.textContent).toContain("Unavailable on signet");
    expect(container.querySelector("a")).toBeNull();
  });

  it("detects availability independently and connects the selected installed wallet", async () => {
    client = {
      ...client,
      isInstalled: (provider) => provider === "unisat",
      installationUrl: () => "https://www.xverse.app/",
    };
    await act(async () =>
      root.render(
        <WalletConnectPanel
          candidates={[
            { id: "xverse", label: "Xverse" },
            { id: "unisat", label: "UniSat" },
          ]}
        />,
      ),
    );
    expect(container.querySelector("a")).toBeNull();
    const selected = container.querySelectorAll("li button")[0];
    if (!(selected instanceof HTMLButtonElement))
      throw new Error("Expected UniSat button");
    expect(selected.textContent).toBe("UniSatDetected");
    await act(async () => selected.click());
    expect(connect).toHaveBeenCalledExactlyOnceWith("unisat");
  });

  it("reports a rejected connection without claiming success", async () => {
    connect.mockRejectedValueOnce(new Error("rejected"));
    await render();
    await act(async () => button().click());
    expect(container.textContent).toContain("connection request was cancelled");
    expect(button().disabled).toBe(false);
    expect(button().getAttribute("aria-busy")).toBe("false");
  });

  it("links to installation when the extension is absent", async () => {
    client = { ...client, isInstalled: () => false };
    connect.mockRejectedValueOnce(new Error("Leather isn't installed"));
    await render();
    await act(async () => button().click());
    const link = container.querySelector("a");
    expect(link?.textContent).toContain("Install Xverse");
    expect(link?.getAttribute("href")).toBe("https://www.xverse.app/");
  });

  it("shows connected state and delegates disconnect", async () => {
    client = {
      ...client,
      address: "tb1q12345678901234567890",
      connected: true,
      provider: "xverse",
    };
    await render();
    expect(container.textContent).toContain("tb1q1234…34567890");
    await act(async () => button().click());
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("never offers installation for account setup errors even when detection is false", async () => {
    client = { ...client, isInstalled: () => false };
    connect.mockRejectedValueOnce({
      code: -32603,
      message: "Wallet not initialized",
    });
    await render();
    await act(async () => button().click());
    expect(container.textContent).toContain("Wallet account setup required");
    expect(container.querySelector("a")).toBeNull();
  });

  it("offers installation for a missing provider even when detection claims it exists", async () => {
    connect.mockRejectedValueOnce(new Error("Tokeo wallet not found"));
    await render();
    await act(async () => button().click());
    expect(container.querySelector("a")?.textContent).toBe("Install Xverse");
  });

  it("disables the control while connection is pending", async () => {
    client = { ...client, connecting: true };
    await render();
    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain("Xverse");
  });

  it("shows progress only on the selected wallet and restores controls when it settles", async () => {
    let finish: (() => void) | undefined;
    connect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await act(async () =>
      root.render(
        <WalletConnectPanel
          candidates={[
            { id: "xverse", label: "Xverse" },
            { id: "unisat", label: "UniSat" },
          ]}
        />,
      ),
    );
    const tiles = container.querySelectorAll<HTMLButtonElement>("li button");
    await act(async () => tiles[0]?.click());
    expect(tiles[0]?.textContent).toContain("Connecting…");
    expect(tiles[0]?.getAttribute("aria-busy")).toBe("true");
    expect(tiles[1]?.textContent).toBe("UniSatDetected");
    expect(tiles[1]?.getAttribute("aria-busy")).toBe("false");
    expect([...tiles].every((tile) => tile.disabled)).toBe(true);
    expect(connect).toHaveBeenCalledExactlyOnceWith("xverse");
    if (!finish) throw new Error("Expected pending connection");
    await act(async () => finish?.());
    expect(container.textContent).not.toContain("Connecting…");
    expect([...tiles].every((tile) => !tile.disabled)).toBe(true);
  });

  it("shows a short connected address without truncation", async () => {
    client = { ...client, address: "short", connected: true };
    await render();
    expect(container.textContent).toContain("short");
  });
});
