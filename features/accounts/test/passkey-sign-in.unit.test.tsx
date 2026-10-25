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

import type { PasskeySignInResult } from "../src/sign-in/passkey-sign-in-flow.ts";

const browser = vi.hoisted(() => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  startAuthentication: vi.fn(async () => ({ id: "credential-one" })),
}));
const flow = vi.hoisted(() => ({ signInWithPasskey: vi.fn() }));
vi.mock("@simplewebauthn/browser", () => browser);
vi.mock("../src/sign-in/passkey-sign-in-flow.ts", () => flow);

import { PasskeySignIn } from "../src/sign-in/passkey-sign-in.tsx";
import { signInViews } from "../src/sign-in/registry.ts";

let container: HTMLElement;
let root: Root;
const onSignedIn = vi.fn();

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.clearAllMocks();
  act(() => {
    root.render(
      <PasskeySignIn expectedNetwork="signet" onSignedIn={onSignedIn} />,
    );
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const button = () => container.querySelector("button");
const press = () =>
  act(async () => {
    button()?.click();
  });
const answering = (result: PasskeySignInResult) =>
  flow.signInWithPasskey.mockResolvedValue(result);

describe("the passkey sign-in view", () => {
  it("offers the button and says nothing of failure before it is used", () => {
    expect(button()?.textContent).toBe("Sign in with passkey");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("gives the flow the browser's own prompt and its support check", async () => {
    answering({ kind: "cancelled" });
    await press();
    const [{ ask, supported }] = flow.signInWithPasskey.mock.calls[0] ?? [{}];
    expect(supported).toBe(browser.browserSupportsWebAuthn);
    const options = {
      challenge: "Y2hhbGxlbmdl",
      rpId: "launch.invalid",
      userVerification: "required" as const,
    };
    await ask(options);
    expect(browser.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: options,
    });
  });

  it("says signed in, and moves on once, only after the flow says the server accepted", async () => {
    answering({ kind: "signed-in" });
    await press();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Signed in",
    );
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(button()?.disabled).toBe(true);
  });

  it.each([
    ["cancelled", "No passkey was used"],
    ["network", "could not reach the server"],
    ["not-verified", "could not be verified"],
    ["unsupported", "cannot use passkeys"],
  ] as const)(
    "tells the person plainly when it ends as %s",
    async (kind, words) => {
      answering({ kind });
      await press();
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        words,
      );
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(onSignedIn).not.toHaveBeenCalled();
      expect(button()?.disabled).toBe(false);
    },
  );

  it("is disabled and says it is waiting while the passkey is being asked for", async () => {
    let finish: (value: PasskeySignInResult) => void = () => {};
    flow.signInWithPasskey.mockReturnValue(
      new Promise<PasskeySignInResult>((resolve) => {
        finish = resolve;
      }),
    );
    await press();
    expect(button()?.disabled).toBe(true);
    expect(button()?.textContent).toContain("Waiting for your passkey");
    await act(async () => finish({ kind: "cancelled" }));
    expect(button()?.disabled).toBe(false);
  });
});

describe("the sign-in page's views", () => {
  it("show each method under the kind the server's registry names", () => {
    expect(signInViews.map(({ kind, label }) => [kind, label])).toEqual([
      ["wallet", "Wallet"],
      ["passkey", "Passkey"],
      ["email", "Email"],
    ]);
  });
});
