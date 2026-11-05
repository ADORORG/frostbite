// A test harness for the wallet widget: a stand-in for the wallet connection library, a scripted server, and the
// handful of helpers every widget test uses. Import it before the widget so the library mock is in place.
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, vi, type Mock } from "vitest";

import { createUuidV7 } from "@frostbite/shared/identifiers";

import type { SessionState } from "../../src/widget/session-state.ts";
import { WalletWidget } from "../../src/widget/wallet-widget.tsx";
import { walletConfig } from "./wallet-config.ts";

const mocks = vi.hoisted(() => ({
  remembered: { value: false },
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
vi.mock("@frostbite/wallet/client", () => ({
  classifyWalletConnectionError: () => ({ kind: "failed", message: "x" }),
  useWalletChooser: () => mocks.chooser,
  hasRememberedWallet: () => mocks.remembered.value,
  useWalletConnection: () => mocks.connection,
  walletNetworkUnavailableReason: () => null,
}));

export const remembered = mocks.remembered;
export const signedOut: Mock = vi.fn();
// What the server said about the session when it rendered the page; tests choose it, as the app's layout does.
let session: SessionState = "signed-out";
export const setSession = (next: SessionState) => {
  session = next;
};
export const address = "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v";
export const second = "tb1qsecondwalletaddress000000000000000000";
export const requests: {
  body: unknown;
  path: string;
  query: Record<string, string>;
}[] = [];
export const answers: Record<string, () => Response | Promise<Response>> = {};
export let container: HTMLElement;
let root: Root;

export const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status });
// A failure as the server sends it: the status class, and the reason when there is one to name (what pages choose their words by).
export const denied = (code: string, status: number, reason?: string) =>
  json(
    {
      error: {
        code,
        correlationId: createUuidV7(),
        message: "no",
        ...(reason === undefined ? {} : { reason }),
      },
    },
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
  // The browser's storage outlives a test: a balance one test read must not be shown to the next.
  localStorage.clear();
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
  remembered.value = false;
  signedOut.mockClear();
  session = "signed-out";
  chooser.request.mockClear();
  vi.stubGlobal("fetch", async (address: string, init?: { body?: string }) => {
    // A read carries its input in the query string; scripted answers are found by the path alone.
    const [path = address, search = ""] = address.split("?");
    requests.push({
      body: init?.body === undefined ? undefined : JSON.parse(init.body),
      path,
      query: Object.fromEntries(new URLSearchParams(search)),
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

// The wallet widget, or whatever else a test puts on the same stand-in connection and scripted server.
export const show = (
  element: ReactElement = (
    <WalletWidget
      balanceRefreshMs={60_000}
      candidates={walletConfig.candidates}
      network="signet"
      onSignedOut={signedOut}
      reconnectWaitMs={10_000}
      session={session}
    />
  ),
) =>
  act(async () => {
    root.render(element);
  });
export const settle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));
export const button = (name: string) =>
  [...container.querySelectorAll("button")].find(
    (b) =>
      b.textContent.includes(name) ||
      b.getAttribute("aria-label")?.includes(name) === true,
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
// What the chip in the header says: the wallet's short address, or why there is none.
export const chip = () => trigger()?.textContent ?? "";
// The balance the menu shows, once it is open.
export const balanceCard = () =>
  container.querySelector(".wallet-balance")?.textContent ?? "";
export const asks = (path: string) =>
  requests.filter((request) => request.path === path);
