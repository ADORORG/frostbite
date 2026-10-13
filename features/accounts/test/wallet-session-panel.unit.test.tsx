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

import { createUuidV7 } from "@ador/shared/identifiers";

import { WalletSessionPanel } from "../src/ui/wallet-session-panel.tsx";
import { walletConfig } from "./support/wallet-config.ts";

const connection = vi.hoisted(() => ({
  address: "",
  connect: async () => undefined,
  connected: false,
  connecting: false,
  disconnect: () => undefined,
  installationUrl: () => "https://install.example",
  isInstalled: () => false,
  network: "signet" as const,
  provider: null as string | null,
  signMessage: async () => "the-signature",
}));
vi.mock("@ador/wallet/client", () => ({
  classifyWalletConnectionError: () => ({ kind: "failed", message: "x" }),
  useWalletConnection: () => connection,
  walletNetworkUnavailableReason: () => null,
  WalletProvider: ({ children }: { children: unknown }) => children,
}));

const address = "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v";
const second = "tb1qsecondwalletaddress000000000000000000";
let container: HTMLElement;
let root: Root;
const requests: { body: unknown; path: string }[] = [];
let answers: Record<string, () => Response> = {};
const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status });
const methods = (addresses: string[]) =>
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
const denied = (code: string, status: number) =>
  json(
    { error: { code, correlationId: createUuidV7(), message: "no" } },
    status,
  );

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  requests.length = 0;
  Object.assign(connection, { address: "", connected: false, provider: null });
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

const show = () =>
  act(async () => {
    root.render(
      <WalletSessionPanel
        candidates={walletConfig.candidates}
        network="signet"
      />,
    );
  });
const settle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));
const button = (name: string) =>
  [...container.querySelectorAll("button")].find((b) =>
    b.textContent.includes(name),
  );
const click = async (name: string) => {
  await act(async () =>
    button(name)?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  await settle();
};

describe("the wallet panel", () => {
  it("says nobody is signed in and offers to choose a wallet, and does not claim a connection that is not there", async () => {
    answers = { "/api/v1/auth/methods": () => denied("unauthorized", 401) };
    await show();
    await settle();
    expect(container.textContent).toContain("Connect a wallet to sign in");
    expect(container.textContent).not.toContain("Connected to");
    expect(button("Choose wallet")).toBeDefined();
    expect(button("Sign in with wallet")).toBeUndefined();
    expect(button("Sign out")).toBeUndefined();
  });

  it("signs the player in with the connected wallet, and says so only once the server has said who is signed in", async () => {
    Object.assign(connection, { address, connected: true, provider: "xverse" });
    let signedIn = false;
    answers = {
      "/api/v1/auth/methods": () =>
        signedIn ? methods([address]) : denied("unauthorized", 401),
      "/api/v1/auth/wallet/challenge": () =>
        json({
          challengeId: createUuidV7(),
          expiresAt: "2026-10-13T12:05:00.000Z",
          message: "sign this",
          signatureScheme: "bip322-simple",
        }),
      "/api/v1/auth/wallet/verify": () => {
        signedIn = true;
        return json({ signedIn: true });
      },
    };
    await show();
    await settle();
    expect(container.textContent).toContain(
      "connected, but you are not signed in",
    );
    expect(container.textContent).not.toContain(
      "You are signed in with this wallet",
    );
    await click("Sign in with wallet");
    expect(container.textContent).toContain(
      "You are signed in with this wallet",
    );
    expect(button("Sign out")).toBeDefined();
    expect(requests.map(({ path }) => path)).toEqual([
      "/api/v1/auth/methods",
      "/api/v1/auth/wallet/challenge",
      "/api/v1/auth/wallet/verify",
      "/api/v1/auth/methods",
    ]);
  });

  it("says a connected wallet is not linked, offers to link it, and says what went wrong in plain words when it cannot be", async () => {
    Object.assign(connection, {
      address: second,
      connected: true,
      provider: "xverse",
    });
    answers = {
      "/api/v1/auth/methods": () => methods([address]),
      "/api/v1/auth/wallet/link/challenge": () =>
        json({
          challengeId: createUuidV7(),
          expiresAt: "2026-10-13T12:05:00.000Z",
          message: "sign this",
          signatureScheme: "bip322-simple",
        }),
      "/api/v1/auth/wallet/link/verify": () => denied("conflict", 409),
    };
    await show();
    await settle();
    expect(container.textContent).toContain(
      "this wallet is not linked to your account",
    );
    await click("Link this wallet");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "This wallet cannot be used for that.",
    );
    expect(button("Link this wallet")).toBeDefined();
  });

  it("lists the wallets that sign in, lets one be removed only while another remains, and says why the last cannot be", async () => {
    Object.assign(connection, { address, connected: true });
    answers = { "/api/v1/auth/methods": () => methods([address]) };
    await show();
    await settle();
    expect(container.textContent).toContain("only way to sign in");
    expect(
      [...container.querySelectorAll("button")].some((b) =>
        b.textContent.startsWith("Remove"),
      ),
    ).toBe(false);
    act(() => root.unmount());
    root = createRoot(container);
    answers = { "/api/v1/auth/methods": () => methods([address, second]) };
    await show();
    await settle();
    expect(container.textContent).not.toContain("only way to sign in");
    expect(
      [...container.querySelectorAll("button")].filter((b) =>
        b.textContent.startsWith("Remove"),
      ),
    ).toHaveLength(2);
  });

  it("asks to sign again when a change needs a recent signature, and says nothing about the wallet that failed", async () => {
    Object.assign(connection, { address, connected: true, provider: "xverse" });
    answers = {
      "/api/v1/auth/methods": () => methods([address, second]),
      "/api/v1/auth/wallet/unlink": () => denied("forbidden", 403),
    };
    await show();
    await settle();
    await click(`Remove ${second.slice(0, 8)}`);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "To change this, sign in again with your wallet first.",
    );
    expect(button("Sign again to confirm")).toBeDefined();
  });

  it("signs out, and goes back to saying nobody is signed in", async () => {
    Object.assign(connection, { address, connected: true });
    answers = {
      "/api/v1/auth/methods": () => methods([address]),
      "/api/v1/auth/sign-out": () => json({ changed: true }),
    };
    await show();
    await settle();
    await click("Sign out");
    expect(container.textContent).toContain("you are not signed in");
    expect(container.textContent).not.toContain("How you sign in");
  });
});
