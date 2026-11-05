// @vitest-environment jsdom
import { outcomeMessage } from "@frostbite/shared/account-outcomes";
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

import { failed } from "../src/client/outcome.ts";
import { emailView } from "./support/email-view.ts";

const flow = vi.hoisted(() => ({
  confirmLinkCode: vi.fn(),
  listEmailAddresses: vi.fn(),
  removeEmailAddress: vi.fn(),
  requestLinkCode: vi.fn(),
}));
vi.mock("../src/ui/email-link-flow.ts", () => flow);

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
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (view: ReturnType<typeof emailView>) =>
  act(() => root.render(<EmailPanel initial={view} />));
const text = () => container.textContent ?? "";
const rows = () =>
  [
    ...container.querySelectorAll('[aria-label="Linked email addresses"] li'),
  ].map((row) => row.textContent ?? "");
const addForm = () => container.querySelector("form");
const lamp = () =>
  container.querySelector('[role="status"]')?.textContent ?? "";
const full = (count: number) =>
  emailView(
    Array.from({ length: count }, (_, at) => `a${String(at)}@b.co`),
    count,
  );

describe("when each address was added", () => {
  it("shows the day beside each address, the oldest first as the server sent them", async () => {
    await mount(emailView(["old@b.co", "new@b.co"]));
    const [first, second] = rows();
    expect(first).toContain("old@b.co");
    expect(first).toContain("Added 1 Oct 2026");
    expect(second).toContain("new@b.co");
    expect(second).toContain("Added 2 Oct 2026");
  });
});

describe("how many addresses the account may hold", () => {
  it("says how many can be linked, and how many are", async () => {
    await mount(emailView(["a@b.co"], 5));
    expect(text()).toContain("Up to 5 can be linked");
    expect(container.querySelector('[aria-label="1 in total"]')).not.toBeNull();
  });

  it("offers to add one below the limit", async () => {
    await mount(emailView(["a@b.co", "c@d.co"], 3));
    expect(addForm()).not.toBeNull();
    expect(text()).not.toContain(outcomeMessage("email-limit-reached"));
  });

  it("at the limit, offers nothing to add and says why, in the catalogue's words; removing is still offered", async () => {
    await mount(full(3));
    expect(addForm()).toBeNull();
    expect(text()).toContain(outcomeMessage("email-limit-reached"));
    expect(
      container.querySelector('button[aria-label="Remove a0@b.co"]'),
    ).not.toBeNull();
  });

  it("brings the form back when one is removed from a full account", async () => {
    flow.removeEmailAddress.mockResolvedValue({ kind: "removed" });
    flow.listEmailAddresses.mockResolvedValue(
      emailView(["a0@b.co", "a1@b.co"], 3),
    );
    await mount(full(3));
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Remove a2@b.co"]')
        ?.click();
    });
    expect(addForm()).not.toBeNull();
    expect(text()).not.toContain(outcomeMessage("email-limit-reached"));
    expect(rows()).toHaveLength(2);
  });

  it("takes the limit from the list it reads again, not the one the page opened with", async () => {
    flow.removeEmailAddress.mockResolvedValue({ kind: "removed" });
    // The server's number changed between the two reads (a deployment moved its limit): the page shows the later one.
    flow.listEmailAddresses.mockResolvedValue(emailView(["a0@b.co"], 2));
    await mount(emailView(["a0@b.co", "a1@b.co"], 3));
    expect(text()).toContain("Up to 3 can be linked");
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Remove a1@b.co"]')
        ?.click();
    });
    expect(text()).toContain("Up to 2 can be linked");
  });

  it("says so, in the catalogue's words, when the server turns an address away at the limit", async () => {
    flow.requestLinkCode.mockResolvedValue(failed("email-limit-reached"));
    await mount(emailView(["a@b.co"], 5));
    const field = container.querySelector("input");
    if (field === null) throw new Error("no field");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    act(() => {
      setter?.call(field, "new@b.co");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      addForm()?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(lamp()).toBe(outcomeMessage("email-limit-reached"));
    expect(addForm()).not.toBeNull();
  });
});
