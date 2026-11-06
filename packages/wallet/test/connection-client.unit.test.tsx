import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WalletConnectionClient } from "../src/client/connection-client.ts";
import { noConnectedAccountMessage } from "../src/client/connection-errors.ts";

const connect = vi.fn(async () => undefined);
const disconnect = vi.fn();
const vendor = vi.hoisted(() => ({
  wallets: Object.fromEntries(
    [
      "binance",
      "keplr",
      "leather",
      "magic-eden",
      "okx",
      "op_net",
      "orange",
      "oyl",
      "phantom",
      "sparrow",
      "tokeo",
      "unisat",
      "wizz",
      "xverse",
    ].map((provider) => [
      provider,
      { name: provider, url: `https://${provider}.example` },
    ]),
  ),
}));
const state = {
  address: "tb1qcandidate",
  connect,
  connected: false,
  disconnect,
  signMessage: vi.fn(async () => "signature"),
  signPsbt: vi.fn(),
  hasBinance: false,
  hasKeplr: false,
  hasLeather: false,
  hasMagicEden: false,
  hasOkx: false,
  hasOpNet: false,
  hasOrange: false,
  hasOyl: false,
  hasPhantom: false,
  hasSparrow: false,
  hasTokeo: false,
  hasUnisat: false,
  hasWizz: false,
  hasXverse: true,
  isConnecting: false,
  network: "signet",
  provider: undefined,
};

vi.mock("@omnisat/lasereyes-react", () => ({
  LaserEyesProvider: ({ children }: { readonly children: React.ReactNode }) =>
    children,
  SUPPORTED_WALLETS: vendor.wallets,
  useLaserEyes: () => state,
}));

import { useLiveWalletConnection as useWalletConnection } from "../src/client/live-connection.tsx";

let captured: WalletConnectionClient | null = null;
function Probe() {
  captured = useWalletConnection();
  return <span>probe</span>;
}

describe("normalized wallet connection client", () => {
  beforeEach(() => {
    captured = null;
    connect.mockClear();
    disconnect.mockClear();
    vendor.wallets.xverse = {
      name: "xverse",
      url: "https://xverse.example",
    };
    Reflect.set(state, "provider", undefined);
  });

  it("maps provider availability and delegates lifecycle calls", async () => {
    renderToStaticMarkup(<Probe />);
    if (captured === null) throw new Error("Expected captured wallet client");
    expect(captured.isInstalled("xverse")).toBe(true);
    expect(captured.isInstalled("unisat")).toBe(false);
    expect(captured.installationUrl("xverse")).toBe("https://xverse.example");
    await captured.connect("xverse");
    captured.disconnect();
    expect(connect).toHaveBeenCalledWith("xverse");
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("normalizes an active provider and rejects missing vendor metadata", () => {
    Reflect.set(state, "provider", "xverse");
    renderToStaticMarkup(<Probe />);
    if (captured === null) throw new Error("Expected captured wallet client");
    expect(captured.provider).toBe("xverse");
    Reflect.deleteProperty(vendor.wallets, "xverse");
    expect(() => captured?.installationUrl("xverse")).toThrow(
      "no installation URL",
    );
  });

  it("requires a connected account and signs only for its current address", async () => {
    renderToStaticMarkup(<Probe />);
    if (captured === null) throw new Error("Expected captured wallet client");
    await expect(captured.signMessage("message")).rejects.toThrow(
      noConnectedAccountMessage,
    );
    Reflect.set(state, "connected", true);
    await expect(captured.signMessage("message")).rejects.toThrow(
      noConnectedAccountMessage,
    );
    Reflect.set(state, "provider", "xverse");
    Reflect.set(state, "address", "");
    await expect(captured.signMessage("message")).rejects.toThrow(
      noConnectedAccountMessage,
    );
    Reflect.set(state, "address", "tb1qcandidate");
    await expect(captured.signMessage("message")).resolves.toBe("signature");
    expect(state.signMessage).toHaveBeenCalledWith("message", {
      toSignAddress: "tb1qcandidate",
      protocol: "bip322",
    });
    Reflect.set(state, "connected", false);
  });

  it("asks the connected wallet to sign the given inputs with its own address, finalised and not sent", async () => {
    renderToStaticMarkup(<Probe />);
    if (captured === null) throw new Error("Expected captured wallet client");
    await expect(captured.signPsbt("psbt", [0])).rejects.toThrow(
      noConnectedAccountMessage,
    );
    Reflect.set(state, "connected", true);
    Reflect.set(state, "provider", "xverse");
    Reflect.set(state, "address", "");
    await expect(captured.signPsbt("psbt", [0])).rejects.toThrow(
      noConnectedAccountMessage,
    );
    Reflect.set(state, "address", "tb1qcandidate");
    state.signPsbt.mockResolvedValueOnce({
      signedPsbtBase64: "signed-base64",
      signedPsbtHex: "signed-hex",
    });
    await expect(captured.signPsbt("psbt", [0, 2])).resolves.toBe(
      "signed-base64",
    );
    expect(state.signPsbt).toHaveBeenCalledWith({
      broadcast: false,
      finalize: true,
      inputsToSign: [
        { address: "tb1qcandidate", index: 0 },
        { address: "tb1qcandidate", index: 2 },
      ],
      tx: "psbt",
    });
    // A wallet that sent the transaction, or answered nothing, is not trusted.
    state.signPsbt.mockResolvedValueOnce({
      signedPsbtBase64: "a",
      signedPsbtHex: "b",
      txId: "sent",
    });
    await expect(captured.signPsbt("psbt", [0])).rejects.toThrow("broadcast");
    state.signPsbt.mockResolvedValueOnce(undefined);
    await expect(captured.signPsbt("psbt", [0])).rejects.toThrow("incomplete");
    Reflect.set(state, "connected", false);
  });
});
