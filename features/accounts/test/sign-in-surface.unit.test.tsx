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

import { SignInSurface } from "../src/sign-in/sign-in-surface.tsx";
import type { SignInView } from "../src/sign-in/views.ts";

let container: HTMLElement;
let root: Root;
const navigate = vi.fn();

// A view that signs in when its button is pressed, as the real ones do once the server has said so.
const view = (kind: string, label: string): SignInView => ({
  Component: ({ expectedNetwork, onSignedIn }) => (
    <button data-network={expectedNetwork} onClick={onSignedIn} type="button">
      {`Sign in via ${kind}`}
    </button>
  ),
  kind,
  label,
});
const views = [view("wallet", "Wallet"), view("email", "Email")];

const show = (offered: readonly string[]) =>
  act(async () => {
    root.render(
      <SignInSurface
        expectedNetwork="signet"
        navigate={navigate}
        offered={offered}
        views={views}
      />,
    );
  });

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  navigate.mockClear();
  window.history.replaceState(null, "", "/sign-in");
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const press = (name: string) =>
  act(async () => {
    [...container.querySelectorAll("button")]
      .find((candidate) => candidate.textContent === name)
      ?.click();
  });

describe("the sign-in page's methods", () => {
  it("shows a panel for each offered method, in the server's order, with the network the wallet is asked for", async () => {
    await show(["email", "wallet"]);
    expect(
      [...container.querySelectorAll("h2, h3")].map((h) => h.textContent),
    ).toEqual(["Email", "Wallet"]);
    expect(
      container.querySelector("[data-network]")?.getAttribute("data-network"),
    ).toBe("signet");
  });

  it("says so, instead of showing an empty page, when nothing can be offered", async () => {
    await show([]);
    expect(container.textContent).toContain(
      "Signing in is not available right now.",
    );
    await show(["phone"]);
    expect(container.textContent).toContain(
      "Signing in is not available right now.",
    );
  });

  it("goes back to the page the visitor came for once a method says they are signed in", async () => {
    window.history.replaceState(null, "", "/sign-in?returnTo=%2Fadmin%2Fgames");
    await show(["wallet"]);
    await press("Sign in via wallet");
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/admin/games");
  });

  it("goes home when there is nowhere in particular to go", async () => {
    await show(["wallet"]);
    await press("Sign in via wallet");
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("never goes to another site, whatever the address asks for", async () => {
    for (const bad of [
      "https%3A%2F%2Fevil.example",
      "%2F%2Fevil.example",
      "javascript%3Aalert(1)",
      "%2Fsign-in",
    ]) {
      navigate.mockClear();
      window.history.replaceState(null, "", `/sign-in?returnTo=${bad}`);
      await show(["wallet"]);
      await press("Sign in via wallet");
      expect(navigate).toHaveBeenCalledExactlyOnceWith("/");
    }
  });
});
