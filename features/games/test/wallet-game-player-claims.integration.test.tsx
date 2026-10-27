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
import { game } from "./support/player-harness.tsx";

// What the stage hands the claims: the page's own player is replaced by one that only records what it was given.
const seen = vi.hoisted(() => ({
  claims: undefined as { sign?: unknown; wallet: unknown } | undefined,
  allowed: [] as readonly string[],
}));
const signer = vi.hoisted(() => vi.fn());
vi.mock("../src/ui/game-player.tsx", () => ({
  GamePlayer: (props: { claims?: { sign?: unknown; wallet: unknown } }) => {
    seen.claims = props.claims;
    return null;
  },
}));
vi.mock("@ador/wallet/client", () => ({
  useStepWallet: (allowed: readonly string[]) => {
    seen.allowed = allowed;
    return {
      address: "",
      sign: allowed.includes("xverse") ? signer : undefined,
    };
  },
  useWalletChooser: () => ({ request: () => undefined }),
  useWalletConnection: () => ({
    address: "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv",
    connected: true,
    network: "signet",
  }),
}));

let container: HTMLElement;
let root: Root;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
beforeEach(() => {
  seen.claims = undefined;
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

const show = (signingWallets: readonly string[], claimable = true) =>
  act(async () =>
    root.render(
      <WalletGamePlayer
        claimable={claimable}
        game={game}
        network="signet"
        signingWallets={signingWallets}
        src="/play/embedded-game/index.html"
        title="Embedded game"
      />,
    ),
  );

describe("the wallet that signs a player's claims", () => {
  it("is the connected wallet's signer when the deployment lets that wallet sign", async () => {
    await show(["xverse"]);
    expect(seen.allowed).toEqual(["xverse"]);
    expect(seen.claims?.sign).toBe(signer);
  });

  it("is none when the connected wallet is not one the deployment lets sign", async () => {
    await show(["unisat"]);
    expect(seen.claims).toBeDefined();
    expect(seen.claims?.sign).toBeUndefined();
  });

  it("is not offered at all for a game whose milestones cannot be claimed", async () => {
    await show(["xverse"], false);
    expect(seen.claims).toBeUndefined();
  });
});
