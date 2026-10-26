// @vitest-environment jsdom
import { ApiError, type Parser, type Requester } from "@ador/client-http";
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

import type { SignInView } from "../src/sign-in/views.ts";
import type { TokenStore } from "../src/setup/setup-flow.ts";
import { SetupSurface } from "../src/setup/setup-surface.tsx";

let container: HTMLElement;
let root: Root;
let held: string | null;
const store: TokenStore = {
  clear: () => {
    held = null;
  },
  read: () => held,
  write: (token) => {
    held = token;
  },
};
// A method that signs in when its button is pressed, as the real ones do once the server has said so.
const views: readonly SignInView[] = [
  {
    Component: ({ onSignedIn }) => (
      <button onClick={onSignedIn} type="button">
        Sign in via wallet
      </button>
    ),
    glyph: "*",
    kind: "wallet",
    label: "Wallet",
    tagline: "Sign a message",
  },
];

function grantedAnswer<Output>(schema: Parser<Output>): Output {
  const parsed = schema.safeParse({ status: "granted" });
  if (!parsed.success)
    throw new Error("The fixture does not satisfy the contract.");
  return parsed.data;
}

// A requester that answers with each of the given outcomes in turn (a code is a failure with that code). Its success is the real
// response schema's own parse of a granted answer, so the fixture cannot drift from the contract.
function server(...outcomes: readonly ("ok" | ApiError["code"])[]) {
  const queue = [...outcomes];
  const sent = vi.fn();
  const request: Requester = async (route, schema, options) => {
    sent(route, schema, options);
    const next = queue.shift() ?? "ok";
    if (next !== "ok") throw new ApiError(next, 400, `server: ${next}`);
    return grantedAnswer(schema);
  };
  return { request, sent };
}

const show = (request: Requester) =>
  act(async () => {
    root.render(
      <SetupSurface
        expectedNetwork="signet"
        offered={["wallet"]}
        request={request}
        store={store}
        views={views}
      />,
    );
  });
const press = (name: string) =>
  act(async () => {
    [...container.querySelectorAll("button")]
      .find((candidate) => candidate.textContent === name)
      ?.click();
  });

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  held = null;
  window.history.replaceState(null, "", "/setup");
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("opening a setup link", () => {
  it("takes the token out of the address bar and saves it, then asks the server to open the link with it", async () => {
    window.history.replaceState(null, "", "/setup#tok_123");
    const { request, sent } = server("unauthorized");
    await show(request);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/setup");
    expect(held).toBe("tok_123");
    expect(sent).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/api/v1/auth/setup-link/redeem" }),
      expect.anything(),
      { body: { token: "tok_123" } },
    );
  });

  it("says there is no link when the address has none and nothing was saved", async () => {
    const { request, sent } = server();
    await show(request);
    expect(container.textContent).toContain("There is no setup link here");
    expect(sent).not.toHaveBeenCalled();
  });

  it("asks a signed-out person to sign in, then opens the link without reloading, and says so only after the server accepted", async () => {
    window.history.replaceState(null, "", "/setup#tok");
    const { request, sent } = server("unauthorized", "ok");
    await show(request);
    expect(container.textContent).toContain("Sign in to finish setting up");
    expect(container.textContent).not.toContain("You are now an administrator");
    await press("Sign in via wallet");
    expect(sent).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("You are now an administrator");
    expect(held).toBeNull();
  });

  it("finds a token saved before a reload, which the address no longer holds", async () => {
    held = "saved";
    const { request, sent } = server("ok");
    await show(request);
    expect(sent).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      body: { token: "saved" },
    });
    expect(container.textContent).toContain("You are now an administrator");
  });

  it("tells the person a link that does not work is not valid, and offers no way to retry it", async () => {
    window.history.replaceState(null, "", "/setup#tok");
    await show(server("not_found").request);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "not valid, or it has expired",
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("relays what the account is missing", async () => {
    window.history.replaceState(null, "", "/setup#tok");
    await show(server("conflict").request);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "server: conflict",
    );
  });

  it("offers a retry after a failure that may pass, and the retry works", async () => {
    window.history.replaceState(null, "", "/setup#tok");
    const { request, sent } = server("network", "ok");
    await show(request);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "server: network",
    );
    await press("Try again");
    expect(sent).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("You are now an administrator");
  });

  it("shows that it is working before the server has answered", async () => {
    window.history.replaceState(null, "", "/setup#tok");
    let finish: () => void = () => {};
    const answered = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const request: Requester = async (_route, schema) => {
      await answered;
      return grantedAnswer(schema);
    };
    await show(request);
    expect(container.textContent).toContain("Opening your setup link");
    expect(container.textContent).not.toContain("You are now an administrator");
    await act(async () => finish());
    expect(container.textContent).toContain("You are now an administrator");
  });
});
