// @vitest-environment jsdom
import { outcomeMessage } from "@ador/shared/account-outcomes";
import { failed } from "../src/client/outcome.ts";
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

import type {
  RequestCodeOutcome,
  VerifyCodeOutcome,
} from "../src/sign-in/email-sign-in-flow.ts";

const flow = vi.hoisted(() => ({
  requestEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}));
vi.mock("../src/sign-in/email-sign-in-flow.ts", () => flow);

import { EmailSignIn } from "../src/sign-in/email-sign-in.tsx";

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
      <EmailSignIn expectedNetwork="signet" onSignedIn={onSignedIn} />,
    );
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const input = () => container.querySelector("input");
const buttons = () => [...container.querySelectorAll("button")];
const button = (name: string) =>
  buttons().find(({ textContent }) => textContent === name);
const alertText = () =>
  container.querySelector('[role="alert"]')?.textContent ?? null;

// A typed value React sees: its change handler listens to the input event, which sets by the element's own setter.
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
const requestAnswers = (outcome: RequestCodeOutcome) =>
  flow.requestEmailCode.mockResolvedValue(outcome);
const verifyAnswers = (outcome: VerifyCodeOutcome) =>
  flow.verifyEmailCode.mockResolvedValue(outcome);

async function toCodeStep() {
  requestAnswers({ kind: "sent" });
  type("Ada@Example.com");
  await submit();
}

describe("asking for the code", () => {
  it("starts with the address field and no failure showing", () => {
    expect(input()?.type).toBe("email");
    expect(input()?.autocomplete).toBe("email");
    expect(button("Email me a code")).toBeDefined();
    expect(alertText()).toBeNull();
    expect(flow.requestEmailCode).not.toHaveBeenCalled();
  });

  it("sends the address as typed, and moves to the code only once the server says it was sent", async () => {
    await toCodeStep();
    expect(flow.requestEmailCode).toHaveBeenCalledWith(
      expect.any(Function),
      "Ada@Example.com",
    );
    expect(container.textContent).toContain("ada@example.com");
    expect(input()?.autocomplete).toBe("one-time-code");
    // It says a code is on its way if the address can receive mail, never that the address has or lacks an account.
    expect(container.textContent).toContain("If that address can receive mail");
  });

  it("shows the request as under way and cannot be pressed twice until the server has answered", async () => {
    let answer: (outcome: RequestCodeOutcome) => void = () => undefined;
    flow.requestEmailCode.mockReturnValue(
      new Promise<RequestCodeOutcome>((resolve) => {
        answer = resolve;
      }),
    );
    type("ada@example.com");
    await submit();
    expect(button("Email me a code")?.getAttribute("aria-busy")).toBe("true");
    expect(button("Email me a code")?.disabled).toBe(true);
    await act(async () => answer({ kind: "sent" }));
    expect(input()?.autocomplete).toBe("one-time-code");
  });

  it.each([
    ["invalid-email", undefined],
    ["network", undefined],
    ["email-unavailable", undefined],
    ["code-not-sent", undefined],
    // The server knows how long to wait, so its words are shown.
    [
      "code-too-soon",
      "A code was sent recently. You can ask for another in 30 seconds.",
    ],
  ] as const)(
    "stays on the address and says why when it is %s",
    async (outcome, serverWords) => {
      requestAnswers(failed(outcome, serverWords));
      type("ada@example.com");
      await submit();
      expect(input()?.type).toBe("email");
      expect(alertText()).toBe(outcomeMessage(outcome, serverWords ?? null));
    },
  );
});

describe("entering the code", () => {
  it("sends the address and the code, then moves on once, saying signed in only after the server did", async () => {
    await toCodeStep();
    verifyAnswers({ kind: "signed-in" });
    type("123456");
    expect(onSignedIn).not.toHaveBeenCalled();
    await submit();
    expect(flow.verifyEmailCode).toHaveBeenCalledWith(
      expect.any(Function),
      "Ada@Example.com",
      "123456",
    );
    expect(onSignedIn).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Signed in",
    );
    expect(container.querySelector("form")).toBeNull();
  });

  it.each(["code-wrong", "rate-limited", "network"] as const)(
    "stays on the code and says why when it is %s",
    async (outcome) => {
      await toCodeStep();
      verifyAnswers(failed(outcome));
      type("000000");
      await submit();
      expect(alertText()).toBe(outcomeMessage(outcome));
      expect(onSignedIn).not.toHaveBeenCalled();
      expect(input()?.autocomplete).toBe("one-time-code");
    },
  );

  it("asks for a new code and clears the old entry when the person wants one", async () => {
    await toCodeStep();
    type("111111");
    await click("Send a new code");
    expect(flow.requestEmailCode).toHaveBeenCalledTimes(2);
    expect(input()?.value).toBe("");
  });

  it("keeps the code step and says why when a new code is refused", async () => {
    await toCodeStep();
    requestAnswers(failed("code-too-soon", "Wait 30 seconds."));
    await click("Send a new code");
    expect(alertText()).toBe("Wait 30 seconds.");
    expect(input()?.autocomplete).toBe("one-time-code");
  });

  it("goes back to the address, forgetting the failure shown", async () => {
    await toCodeStep();
    verifyAnswers(failed("code-wrong"));
    type("000000");
    await submit();
    await click("Use a different address");
    expect(input()?.type).toBe("email");
    expect(alertText()).toBeNull();
  });
});
