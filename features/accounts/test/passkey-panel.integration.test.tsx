// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { outcomeMessage } from "@frostbite/shared/account-outcomes";
import { createUuidV7 } from "@frostbite/shared/identifiers";

const browser = vi.hoisted(() => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  startRegistration: vi.fn(),
}));
vi.mock("@simplewebauthn/browser", () => browser);
const { startRegistration } = browser;

import { PasskeyPanel } from "../src/ui/passkey-panel.tsx";

function response(body: object) {
  return new Response(JSON.stringify(body), { status: 200 });
}
// An answer the server gives when it refuses, as its error envelope: the code, and the reason the page chooses its words by.
function refusal(code: string, reason?: string) {
  return new Response(
    JSON.stringify({
      error: {
        code,
        correlationId: createUuidV7(),
        message: "the server said no",
        ...(reason === undefined ? {} : { reason }),
      },
    }),
    { status: 409 },
  );
}

function registrationOptions() {
  return {
    challengeId: "01990a03-5d80-7c00-8000-000000000001",
    expiresAt: "2026-09-10T12:05:00.000Z",
    options: {
      challenge: "Y2hhbGxlbmdl",
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      rp: { id: "launch.invalid", name: "Launch" },
      user: { displayName: "Player", id: "cGxheWVy", name: "Player" },
    },
  };
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!match) throw new Error(`Missing ${label} button`);
  return match;
}

describe("passkey account panel", () => {
  let container: HTMLDivElement;

  beforeAll(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
  });

  it("links and removes passkeys while showing truthful state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(registrationOptions()))
      .mockResolvedValueOnce(response({ changed: true }))
      .mockResolvedValueOnce(response({ credentialIds: ["credential"] }))
      .mockResolvedValueOnce(response({ changed: true }))
      .mockResolvedValueOnce(response({ credentialIds: [] }));
    vi.stubGlobal("fetch", fetchMock);
    startRegistration.mockResolvedValue({
      clientExtensionResults: {},
      id: "credential",
      rawId: "credential",
      response: { attestationObject: "value", clientDataJSON: "value" },
      type: "public-key",
    });
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PasskeyPanel initialCredentialIds={[]} initialUnavailable={false} />,
      ),
    );
    await act(async () => button(container, "Add passkey").click());
    expect(container.textContent).toContain("Passkey linked");
    expect(container.querySelector(".status-lamp--ready")).not.toBeNull();
    expect(container.textContent).toContain("Passkey 1");
    await act(async () => button(container, "Remove").click());
    expect(container.textContent).toContain("Passkey removed");
    expect(container.querySelector(".status-lamp--ready")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    await act(async () => root.unmount());
  });

  it("fails closed when status loading or linking fails", async () => {
    startRegistration.mockClear();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(refusal("conflict", "passkey-change-failed"));
    vi.stubGlobal("fetch", fetchMock);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PasskeyPanel initialCredentialIds={[]} initialUnavailable />,
      ),
    );
    expect(container.textContent).toContain("status is unavailable");
    await act(async () => button(container, "Add passkey").click());
    expect(container.textContent).toContain(
      outcomeMessage("passkey-change-failed"),
    );
    expect(startRegistration).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("does not claim removal when unlinking fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(refusal("conflict", "passkey-change-failed")),
    );
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PasskeyPanel
          initialCredentialIds={["credential"]}
          initialUnavailable={false}
        />,
      ),
    );
    await act(async () => button(container, "Remove").click());
    expect(container.textContent).toContain(
      outcomeMessage("passkey-change-failed"),
    );
    expect(container.textContent).not.toContain("Passkey removed");
    expect(container.querySelector(".status-lamp--unavailable")).not.toBeNull();
    expect(container.textContent).toContain("Passkey 1");
    await act(async () => root.unmount());
  });

  it("reports an unknown outcome when linking succeeds but refresh fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(registrationOptions()))
        .mockResolvedValueOnce(response({ changed: true }))
        .mockResolvedValueOnce(refusal("internal_error")),
    );
    startRegistration.mockResolvedValue({
      clientExtensionResults: {},
      id: "credential",
      rawId: "credential",
      response: { attestationObject: "value", clientDataJSON: "value" },
      type: "public-key",
    });
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PasskeyPanel initialCredentialIds={[]} initialUnavailable={false} />,
      ),
    );
    await act(async () => button(container, "Add passkey").click());
    expect(container.textContent).toContain(
      outcomeMessage("passkey-change-failed"),
    );
    expect(container.textContent).not.toContain("Passkey linked.");
    await act(async () => root.unmount());
  });

  it("asks for a fresh sign-in, in the catalogue's words, when the server says that is what it needs", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(registrationOptions()))
        .mockResolvedValueOnce(
          refusal("forbidden", "recent-authentication-required"),
        ),
    );
    startRegistration.mockResolvedValue({ id: "credential" });
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PasskeyPanel initialCredentialIds={[]} initialUnavailable={false} />,
      ),
    );
    await act(async () => button(container, "Add passkey").click());
    expect(container.textContent).toContain(
      outcomeMessage("recent-authentication-required"),
    );
    await act(async () => root.unmount());
  });

  it("says no passkey was used when the prompt is closed, and the browser's lack of passkeys before asking the server anything", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(registrationOptions()));
    vi.stubGlobal("fetch", fetchMock);
    startRegistration.mockRejectedValue(new Error("NotAllowedError"));
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PasskeyPanel initialCredentialIds={[]} initialUnavailable={false} />,
      ),
    );
    await act(async () => button(container, "Add passkey").click());
    expect(container.textContent).toContain(
      outcomeMessage("passkey-cancelled"),
    );
    browser.browserSupportsWebAuthn.mockReturnValueOnce(false);
    fetchMock.mockClear();
    await act(async () => button(container, "Add passkey").click());
    expect(container.textContent).toContain(
      outcomeMessage("passkey-unsupported"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
