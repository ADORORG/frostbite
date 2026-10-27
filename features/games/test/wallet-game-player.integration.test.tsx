// @vitest-environment jsdom

import { act } from "react";
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

import { WalletGamePlayer } from "../src/ui/wallet-game-player.tsx";
import { shortenMiddle } from "@repo/ui/arcade";
import { game } from "./support/player-harness.tsx";

// The wallet library is a vendor boundary with its own qualification; what is tested here is what the page
// makes of the state it reports.
const state = vi.hoisted(() => ({
  address: "",
  connected: false,
  network: "signet" as "mainnet" | "signet",
  requests: 0,
}));
vi.mock("@ador/wallet/client", () => ({
  useStepWallet: () => ({ address: "", sign: undefined }),
  useWalletChooser: () => ({
    request: () => {
      state.requests += 1;
    },
  }),
  useWalletConnection: () => state,
}));

const address =
  "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv";
let container: HTMLElement;
let root: Root;

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  Object.assign(state, {
    address: "",
    connected: false,
    network: "signet",
    requests: 0,
  });
  vi.spyOn(HTMLIFrameElement.prototype, "setAttribute").mockImplementation(
    () => undefined,
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const show = () =>
  act(async () =>
    root.render(
      <WalletGamePlayer
        game={{ ...game, capabilities: ["wallet"] }}
        network="signet"
        signingWallets={["xverse"]}
        src="/play/embedded-game/index.html"
        title="Embedded game"
      />,
    ),
  );

describe("the stage with the player's wallet behind it", () => {
  it("shows no wallet while none is connected, and asks for the app's chooser rather than building its own", async () => {
    await show();
    expect(container.textContent).toContain("No wallet is connected.");
    const connect = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Connect a wallet",
    );
    await act(async () => connect?.click());
    expect(state.requests).toBe(1);
  });

  it("shows the connected wallet's address and network", async () => {
    Object.assign(state, { address, connected: true, network: "mainnet" });
    await show();
    expect(container.textContent).toContain(shortenMiddle(address));
    expect(container.textContent).toContain("on mainnet");
  });

  it("treats a wallet that reports an address the protocol cannot carry as no wallet", async () => {
    Object.assign(state, { address: "not an address!", connected: true });
    await show();
    expect(container.textContent).toContain("No wallet is connected.");
  });

  it("treats a wallet that is not connected as none, whatever address it last held", async () => {
    Object.assign(state, { address, connected: false });
    await show();
    expect(container.textContent).toContain("No wallet is connected.");
    expect(container.textContent).not.toContain(shortenMiddle(address));
  });
});
