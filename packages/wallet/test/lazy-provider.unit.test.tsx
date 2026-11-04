// @vitest-environment jsdom
import { noConnectedAccountMessage } from "../src/client/connection-errors.ts";
import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  idleConnection,
  type WalletConnectionClient,
} from "../src/client/connection-client.ts";
import type { ConnectionStore } from "../src/client/connection-store.ts";

const loaded = vi.hoisted(() => ({
  count: 0,
  installed: true,
  // Tells the fake library a wallet extension has appeared.
  appear: (() => undefined) as () => void,
}));
const liveConnect = vi.hoisted(() =>
  vi.fn<(provider: string) => Promise<void>>(async () => undefined),
);

// Stands in for the module that holds the wallet library: loading it is counted, and it publishes a connected wallet.
vi.mock("../src/client/live-connection.tsx", async () => {
  loaded.count += 1;
  const { idleConnection: idle } =
    await import("../src/client/connection-client.ts");
  return {
    default: ({ store }: { store: ConnectionStore }) => {
      const [, redraw] = useState(0);
      loaded.appear = () => {
        loaded.installed = true;
        redraw((n) => n + 1);
      };
      useEffect(() =>
        store.publish({
          ...idle("signet", async () => undefined),
          address: "tb1qlive",
          connect: liveConnect,
          connected: true,
          isInstalled: () => loaded.installed,
        }),
      );
      return null;
    },
  };
});

import {
  useWalletChooser,
  useWalletConnection,
  WalletProvider,
} from "../src/client/provider.tsx";

let container: HTMLElement;
let root: Root;
let seen: WalletConnectionClient | null = null;
let chooser: ReturnType<typeof useWalletChooser> | null = null;
function Probe() {
  seen = useWalletConnection();
  chooser = useWalletChooser();
  return <span>{seen.connected ? "connected" : "idle"}</span>;
}
const settle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
const mount = () =>
  act(async () => {
    root.render(
      <WalletProvider network="signet">
        <Probe />
      </WalletProvider>,
    );
  });

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
beforeEach(() => {
  localStorage.clear();
  seen = null;
  chooser = null;
  liveConnect.mockClear();
  loaded.installed = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("the wallet connection before the wallet library is wanted", () => {
  it("is idle, and does not load the library, on a page that never asks for a wallet", async () => {
    await mount();
    await settle();
    expect(container.textContent).toBe("idle");
    expect(seen?.connected).toBe(false);
    expect(seen?.isInstalled("xverse")).toBe(false);
    expect(() => seen?.installationUrl("xverse")).toThrow("not been loaded");
    await expect(seen?.signMessage("hi")).rejects.toThrow(
      noConnectedAccountMessage,
    );
    await expect(seen?.signPsbt("psbt", [0])).rejects.toThrow(
      noConnectedAccountMessage,
    );
    expect(loaded.count).toBe(0);
  });

  it("is the library's connection once a wallet was remembered from an earlier visit, which is loaded to reconnect it", async () => {
    localStorage.setItem("defaultWallet", "xverse");
    await mount();
    await settle();
    expect(container.textContent).toBe("connected");
    expect(seen?.address).toBe("tb1qlive");
  });

  it("loads the library when the chooser is asked for", async () => {
    await mount();
    await act(async () => chooser?.request());
    await settle();
    expect(container.textContent).toBe("connected");
    expect(chooser?.open).toBe(true);
  });

  it("loads the library to connect, and connects with it once it is there", async () => {
    await mount();
    await act(async () => void seen?.connect("xverse"));
    await settle();
    expect(liveConnect).toHaveBeenCalledWith("xverse");
    expect(container.textContent).toBe("connected");
  });

  it("holds a connect until the library has found the wallet asked for, then connects", async () => {
    loaded.installed = false;
    await mount();
    await act(async () => void seen?.connect("xverse"));
    await settle();
    expect(container.textContent).toBe("connected");
    expect(liveConnect).not.toHaveBeenCalled();
    await act(async () => loaded.appear());
    await settle();
    expect(liveConnect).toHaveBeenCalledWith("xverse");
  });

  it("is idle for the network it was given", async () => {
    expect(idleConnection("mainnet", async () => undefined).network).toBe(
      "mainnet",
    );
  });
});

describe("using the connection with no provider", () => {
  it("says what is missing", () => {
    function Bare() {
      useWalletConnection();
      return null;
    }
    const quiet = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(() => act(() => root.render(<Bare />))).toThrow(
      "needs a WalletProvider",
    );
    quiet.mockRestore();
  });
});
