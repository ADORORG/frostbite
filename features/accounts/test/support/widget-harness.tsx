// A test harness for the wallet widget: a stand-in for the wallet connection library, a scripted server, and the
// handful of helpers every widget test uses. Import it before the widget so the library mock is in place.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, vi, type Mock } from "vitest";

import { createUuidV7 } from "@ador/shared/identifiers";

import { WalletWidget } from "../../src/widget/wallet-widget.tsx";
import { walletConfig } from "./wallet-config.ts";

const mocks = vi.hoisted(() => ({
  chooser: { dismiss: vi.fn(), open: false, request: vi.fn() },
  connection: {
    address: "",
    connect: async () => undefined,
    connected: false,
    connecting: false,
    disconnect: vi.fn(),
    installationUrl: () => "https://install.example",
    isInstalled: () => false,
    network: "signet" as "mainnet" | "signet",
    provider: null as string | null,
    signMessage: async () => "the-signature",
  },
}));
interface ConnectionMock {
  address: string;
  connect: () => Promise<undefined>;
  connected: boolean;
  connecting: boolean;
  disconnect: Mock;
  installationUrl: () => string;
  isInstalled: () => boolean;
  network: "mainnet" | "signet";
  provider: string | null;
  signMessage: () => Promise<string>;
}
export const chooser: { dismiss: Mock; open: boolean; request: Mock } =
  mocks.chooser;
export const connection: ConnectionMock = mocks.connection;
vi.mock("@ador/wallet/client", () => ({
  classifyWalletConnectionError: () => ({ kind: "failed", message: "x" }),
  useWalletChooser: () => mocks.chooser,
  useWalletConnection: () => mocks.connection,
  walletNetworkUnavailableReason: () => null,
}));

export const address = "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v";
export const second = "tb1qsecondwalletaddress000000000000000000";
export const requests: { body: unknown; path: string }[] = [];
export const answers: Record<string, () => Response> = {};
export let container: HTMLElement;
let root: Root;

export const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status });
export const denied = (code: string, status: number) =>
  json(
    { error: { code, correlationId: createUuidV7(), message: "no" } },
    status,
  );
export const methods = (addresses: string[]) =>
  json({
    passkeys: [],
    recentAuthentication: true,
    wallets: addresses.map((a) => ({
      address: a,
      id: createUuidV7(),
      linkedAt: "2026-10-13T12:00:00.000Z",
      network: "signet",
      walletAdapter: "xverse",
    })),
  });
export const challenge = () =>
  json({
    challengeId: createUuidV7(),
    expiresAt: "2026-10-13T12:05:00.000Z",
    message: "sign this",
    signatureScheme: "bip322-simple",
  });

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  requests.length = 0;
  for (const key of Object.keys(answers)) delete answers[key];
  // The menu reads the balance whenever it opens; unless a test says otherwise there is no data source.
  answers["/api/v1/wallet/balance"] = () =>
    json({ reason: "not-configured", status: "unavailable" });
  Object.assign(connection, {
    address: "",
    connected: false,
    network: "signet",
    provider: null,
  });
  Object.assign(chooser, { open: false });
  connection.disconnect.mockClear();
  chooser.request.mockClear();
  vi.stubGlobal("fetch", async (path: string, init?: { body?: string }) => {
    requests.push({
      body: init?.body === undefined ? undefined : JSON.parse(init.body),
      path,
    });
    const answer = answers[path];
    if (answer === undefined) throw new Error(`Unexpected request to ${path}`);
    return answer();
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

export const show = () =>
  act(async () => {
    root.render(
      <WalletWidget
        balanceRefreshMs={60_000}
        candidates={walletConfig.candidates}
        network="signet"
      />,
    );
  });
export const settle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));
export const button = (name: string) =>
  [...container.querySelectorAll("button")].find((b) =>
    b.textContent.includes(name),
  );
export const click = async (name: string) => {
  await act(async () =>
    button(name)?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  await settle();
};
export const trigger = () =>
  container.querySelector<HTMLButtonElement>(".wallet-widget__trigger");
export const openMenu = async () => {
  await act(async () =>
    trigger()?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  await settle();
};
export const asks = (path: string) =>
  requests.filter((request) => request.path === path);
