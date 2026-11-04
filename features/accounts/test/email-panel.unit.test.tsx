// @vitest-environment jsdom
import { outcomeMessage } from "@ador/shared/account-outcomes";
import { failed } from "../src/client/outcome.ts";
import { renderToStaticMarkup } from "react-dom/server";
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

import { emailView } from "./support/email-view.ts";

const flow = vi.hoisted(() => ({
  confirmLinkCode: vi.fn(),
  listEmailAddresses: vi.fn(),
  removeEmailAddress: vi.fn(),
  requestLinkCode: vi.fn(),
}));
vi.mock("../src/ui/email-link-flow.ts", () => flow);
// The account page also holds the wallets card, which reads the wallet connection; there is none to read in a page rendered to text.
vi.mock("@ador/wallet/client", () => ({
  useWalletChooser: () => ({ request: () => undefined }),
  useWalletConnection: () => ({
    address: "",
    connected: false,
    network: "signet",
    provider: null,
  }),
}));

import { AccountSurface } from "../src/ui/account-surface.tsx";
import { EmailPanel } from "../src/ui/email-panel.tsx";

let container: HTMLElement;
let root: Root;

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  flow.listEmailAddresses.mockResolvedValue(emailView(["a@b.co", "new@b.co"]));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (addresses: readonly string[]) =>
  act(() => root.render(<EmailPanel initial={emailView(addresses)} />));
const input = () => container.querySelector("input");
// A button is found by its words, or by its accessible name where its words repeat down a list ("Remove" beside each address).
const button = (name: string) =>
  [...container.querySelectorAll("button")].find(
    (candidate) =>
      candidate.textContent === name ||
      candidate.getAttribute("aria-label") === name,
  );
const lamp = () =>
  container.querySelector('[role="status"]')?.textContent ?? "";
function type(value: string) {
  const field = input();
  if (field === null) throw new Error("no field");
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const submit = () =>
  act(async () => {
    container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
const click = (name: string) =>
  act(async () => {
    button(name)?.click();
  });
async function toCodeStep() {
  flow.requestLinkCode.mockResolvedValue({ kind: "sent" });
  type("New@B.co");
  await submit();
}

describe("the account page", () => {
  it("shows the email panel only when the deployment has mail", () => {
    const withMail = renderToStaticMarkup(
      <AccountSurface
        actorUserId={createUuidV7()}
        emailAddresses={emailView(["a@b.co"])}
        expectedNetwork="signet"
      />,
    );
    const without = renderToStaticMarkup(
      <AccountSurface
        actorUserId={createUuidV7()}
        emailAddresses={null}
        expectedNetwork="signet"
      />,
    );
    const unspecified = renderToStaticMarkup(
      <AccountSurface actorUserId={createUuidV7()} expectedNetwork="signet" />,
    );
    expect(withMail).toContain("Email addresses");
    expect(withMail).toContain("a@b.co");
    expect(without).not.toContain("Email addresses");
    expect(unspecified).not.toContain("Email addresses");
  });
});

describe("the addresses", () => {
  it("lists each with a remove button named for it, or says there is none", async () => {
    await mount(["a@b.co", "c@d.co"]);
    expect(container.textContent).toContain("a@b.co");
    expect(button("Remove c@d.co")).toBeDefined();
  });

  it("says there is none when there is none", async () => {
    await mount([]);
    expect(container.textContent).toContain("No email address is linked");
  });

  it("removes one, shows the list the server now has, and says other sessions were signed out only after the server did it", async () => {
    flow.removeEmailAddress.mockResolvedValue({ kind: "removed" });
    flow.listEmailAddresses.mockResolvedValue(emailView(["a@b.co"]));
    await mount(["a@b.co", "c@d.co"]);
    await click("Remove c@d.co");
    expect(flow.removeEmailAddress).toHaveBeenCalledWith(
      expect.any(Function),
      "c@d.co",
    );
    expect(container.textContent).not.toContain("c@d.co");
    expect(lamp()).toContain("Address removed");
    expect(container.querySelector(".status-lamp--ready")).not.toBeNull();
  });

  it.each([
    "last-sign-in-method",
    "email-missing",
    "recent-authentication-required",
    "signed-out",
    "network",
  ] as const)(
    "keeps the list and says why when removal fails as %s",
    async (outcome) => {
      flow.removeEmailAddress.mockResolvedValue(failed(outcome));
      await mount(["a@b.co", "c@d.co"]);
      await click("Remove c@d.co");
      expect(lamp()).toBe(outcomeMessage(outcome));
      expect(container.textContent).toContain("c@d.co");
      expect(flow.listEmailAddresses).not.toHaveBeenCalled();
    },
  );

  it("says the list could not be refreshed rather than showing one it did not read", async () => {
    flow.removeEmailAddress.mockResolvedValue({ kind: "removed" });
    flow.listEmailAddresses.mockRejectedValue(new Error("down"));
    await mount(["a@b.co", "c@d.co"]);
    await click("Remove c@d.co");
    // The change was made; the page says so and that the list may be stale, instead of claiming a clean success.
    expect(lamp()).toContain("Address removed");
    expect(lamp()).toContain("could not be refreshed");
    expect(container.querySelector(".status-lamp--attention")).not.toBeNull();
    expect(container.querySelector(".status-lamp--ready")).toBeNull();
  });

  it("says the same after adding an address when the list could not be read again", async () => {
    flow.confirmLinkCode.mockResolvedValue({ kind: "linked" });
    flow.listEmailAddresses.mockRejectedValue(new Error("down"));
    await mount(["a@b.co"]);
    await toCodeStep();
    type("123456");
    await submit();
    expect(lamp()).toContain("Address added");
    expect(lamp()).toContain("could not be refreshed");
    expect(container.querySelector(".status-lamp--attention")).not.toBeNull();
    expect(container.querySelector(".status-lamp--ready")).toBeNull();
  });
});

describe("adding an address", () => {
  it("asks for a code, moves to the code only once the server said it was sent, and names the address", async () => {
    await mount(["a@b.co"]);
    await toCodeStep();
    expect(flow.requestLinkCode).toHaveBeenCalledWith(
      expect.any(Function),
      "New@B.co",
    );
    expect(input()?.autocomplete).toBe("one-time-code");
    expect(container.textContent).toContain("new@b.co");
    expect(lamp()).toContain("If that address can receive mail");
  });

  it.each([
    ["invalid-email", undefined],
    ["recent-authentication-required", undefined],
    ["signed-out", undefined],
    ["email-unavailable", undefined],
    ["network", undefined],
    // The server knows how long to wait, so its words are shown.
    ["code-too-soon", "A code was sent recently. Wait 30 seconds."],
  ] as const)(
    "stays on the address and says why when the request fails as %s",
    async (outcome, serverWords) => {
      flow.requestLinkCode.mockResolvedValue(failed(outcome, serverWords));
      await mount(["a@b.co"]);
      type("new@b.co");
      await submit();
      expect(input()?.type).toBe("email");
      expect(lamp()).toBe(outcomeMessage(outcome, serverWords ?? null));
    },
  );

  it("adds the address when the code is right: the list is read again and the form starts over", async () => {
    flow.confirmLinkCode.mockResolvedValue({ kind: "linked" });
    await mount(["a@b.co"]);
    await toCodeStep();
    type("123456");
    await submit();
    expect(flow.confirmLinkCode).toHaveBeenCalledWith(
      expect.any(Function),
      "New@B.co",
      "123456",
    );
    expect(container.textContent).toContain("new@b.co");
    expect(lamp()).toContain("Address added");
    expect(container.querySelector(".status-lamp--ready")).not.toBeNull();
    expect(input()?.type).toBe("email");
    expect(input()?.value).toBe("");
  });

  it.each([
    "code-wrong",
    "email-taken",
    "recent-authentication-required",
    "signed-out",
    "network",
  ] as const)(
    "stays on the code and says why when entering it fails as %s",
    async (outcome) => {
      flow.confirmLinkCode.mockResolvedValue(failed(outcome));
      await mount(["a@b.co"]);
      await toCodeStep();
      type("000000");
      await submit();
      expect(lamp()).toBe(outcomeMessage(outcome));
      expect(input()?.autocomplete).toBe("one-time-code");
      expect(flow.listEmailAddresses).not.toHaveBeenCalled();
    },
  );

  it("can ask for a new code, and can go back to a different address", async () => {
    await mount(["a@b.co"]);
    await toCodeStep();
    await click("Send a new code");
    expect(flow.requestLinkCode).toHaveBeenCalledTimes(2);
    await click("Use a different address");
    expect(input()?.type).toBe("email");
  });

  it("shows a request as under way and cannot be pressed twice", async () => {
    let answer: (outcome: object) => void = () => undefined;
    flow.requestLinkCode.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    await mount(["a@b.co"]);
    type("new@b.co");
    await submit();
    expect(button("Email me a code")?.getAttribute("aria-busy")).toBe("true");
    expect(button("Email me a code")?.disabled).toBe(true);
    await act(async () => answer({ kind: "sent" }));
    expect(input()?.autocomplete).toBe("one-time-code");
  });
});
