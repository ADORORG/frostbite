// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WalletConnectionClient } from "@ador/wallet/client";
import { WalletQualificationPanel } from "../src/ui/wallet-qualification-panel.tsx";

const challenge = {
  challengeId: "01992cca-9c00-7000-8000-000000000001",
  expiresAt: "2026-10-04T12:05:00.000Z",
  message: "qualification message",
  signatureScheme: "bip322-simple",
};
const fetchMock = vi.fn<typeof fetch>();
const verifiedResult = { signatureVerified: true, sessionCreated: false };
let wallet: WalletConnectionClient;
let container: HTMLDivElement;
let root: Root;
const signMessage = vi.fn<WalletConnectionClient["signMessage"]>();
async function render() {
  await act(async () =>
    root.render(<WalletQualificationPanel wallet={wallet} />),
  );
}
function button() {
  const found = container.querySelector("button");
  if (!found) throw new Error("Expected qualification button");
  return found;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fetchMock.mockReset();
  signMessage.mockReset();
  signMessage.mockResolvedValue("signature");
  fetchMock.mockResolvedValueOnce(Response.json(challenge));
  fetchMock.mockResolvedValueOnce(Response.json(verifiedResult));
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  wallet = {
    address: "tb1qcandidate",
    connected: true,
    connecting: false,
    network: "signet",
    provider: "xverse",
    connect: vi.fn(),
    disconnect: vi.fn(),
    signMessage,
    isInstalled: () => true,
    installationUrl: () => "https://wallet.example",
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
describe("message qualification UI", () => {
  it("signs the server message and verifies it without claiming sign-in", async () => {
    await render();
    await act(async () => button().click());
    expect(signMessage).toHaveBeenCalledExactlyOnceWith(challenge.message);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/wallet-qualification/challenge",
      expect.objectContaining({
        body: JSON.stringify({
          address: wallet.address,
          provider: "xverse",
          network: "signet",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/wallet-qualification/verify",
      expect.objectContaining({
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          message: challenge.message,
          signature: "signature",
        }),
      }),
    );
    expect(container.textContent).toContain(
      "Signature verified by the server. No session created.",
    );
    expect(button().disabled).toBe(false);
  });
  it.each([
    "challenge-http",
    "challenge-schema",
    "signature-rejection",
    "verify-http",
    "verify-schema",
  ])("recovers from %s without reporting success", async (failure) => {
    if (failure === "challenge-http")
      fetchMock
        .mockReset()
        .mockResolvedValueOnce(Response.json(challenge, { status: 503 }))
        .mockResolvedValueOnce(Response.json(verifiedResult));
    if (failure === "challenge-schema")
      fetchMock
        .mockReset()
        .mockResolvedValueOnce(Response.json({ message: "not a challenge" }))
        .mockResolvedValueOnce(Response.json(verifiedResult));
    if (failure === "signature-rejection")
      signMessage.mockRejectedValue(new Error("rejected"));
    if (failure === "verify-http")
      fetchMock
        .mockReset()
        .mockResolvedValueOnce(Response.json(challenge))
        .mockResolvedValueOnce(Response.json(verifiedResult, { status: 400 }));
    if (failure === "verify-schema")
      fetchMock
        .mockReset()
        .mockResolvedValueOnce(Response.json(challenge))
        .mockResolvedValueOnce(
          Response.json({ signatureVerified: true, sessionCreated: true }),
        );
    await render();
    await act(async () => button().click());
    expect(container.textContent).toContain("The test did not complete.");
    expect(container.textContent).not.toContain(
      "Signature verified by the server",
    );
    expect(button().disabled).toBe(false);
  });
  it("prevents duplicate prompts and discards account changes during approval", async () => {
    let resolve: ((signature: string) => void) | undefined;
    signMessage.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await render();
    await act(async () => {
      button().click();
      button().click();
    });
    expect(button().disabled).toBe(true);
    expect(signMessage).toHaveBeenCalledOnce();
    wallet = { ...wallet, address: "another account" };
    await render();
    if (!resolve) throw new Error("Expected signature prompt");
    await act(async () => resolve?.("signature"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("The test did not complete.");
  });
  it("does not verify after unmount during a wallet prompt", async () => {
    let resolve: ((signature: string) => void) | undefined;
    signMessage.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await render();
    await act(async () => button().click());
    await act(async () => root.render(null));
    if (!resolve) throw new Error("Expected signature prompt");
    await act(async () => resolve?.("signature"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(["challenge", "verification"] as const)(
    "discards wallet changes while awaiting %s",
    async (stage) => {
      let release: ((response: Response) => void) | undefined;
      const waiting = new Promise<Response>((resolve) => {
        release = resolve;
      });
      fetchMock.mockReset();
      if (stage === "verification")
        fetchMock.mockResolvedValueOnce(Response.json(challenge));
      fetchMock.mockReturnValueOnce(waiting);
      await render();
      await act(async () => button().click());
      wallet = { ...wallet, network: "mainnet" };
      await render();
      if (!release) throw new Error("Expected pending server response");
      await act(async () =>
        release?.(
          Response.json(stage === "challenge" ? challenge : verifiedResult),
        ),
      );
      expect(signMessage).toHaveBeenCalledTimes(stage === "challenge" ? 0 : 1);
      expect(fetchMock).toHaveBeenCalledTimes(stage === "challenge" ? 1 : 2);
      expect(container.textContent).toContain("The test did not complete.");
      expect(container.textContent).not.toContain(
        "Signature verified by the server",
      );
      expect(button().disabled).toBe(false);
    },
  );
});
