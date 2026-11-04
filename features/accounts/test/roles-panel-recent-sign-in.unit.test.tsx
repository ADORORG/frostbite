// @vitest-environment jsdom
import { outcomeMessage } from "@ador/shared/account-outcomes";
import { createUuidV7 } from "@ador/shared/identifiers";
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

const flow = vi.hoisted(() => ({
  findPeople: vi.fn(),
  grantRole: vi.fn(),
  listPeople: vi.fn(),
  searchPeople: vi.fn(),
  suspendRole: vi.fn(),
}));
vi.mock("../src/roles/roles-flow.ts", () => flow);
// The wallet confirmation has its own test; here it is a button that says the administrator confirmed.
vi.mock("../src/roles/confirm-it-is-you.tsx", () => ({
  ConfirmItIsYou: ({ onConfirmed }: { onConfirmed: () => void }) => (
    <button onClick={onConfirmed} type="button">
      Confirm it is you
    </button>
  ),
}));

import { RolesPanel } from "../src/roles/roles-panel.tsx";
import type { Person } from "../src/roles/roles-flow.ts";

const adaId = createUuidV7();
const graceId = createUuidV7();
const ada: Person = {
  label: "ada@example.com",
  roles: [
    { effective: true, role: "admin", status: "active" },
    { effective: true, role: "staff", status: "active" },
  ],
  userId: adaId,
};
const grace: Person = {
  label: "grace@example.com",
  roles: [],
  userId: graceId,
};

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
  flow.listPeople.mockResolvedValue([ada]);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (people: readonly Person[]) =>
  act(() => root.render(<RolesPanel initialPeople={people} />));
const button = (name: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === name || b.textContent === name,
  );
const lamp = () =>
  container.querySelector('[role="status"]')?.textContent ?? "";
const press = (name: string) =>
  act(async () => {
    button(name)?.click();
  });

describe("a change that needs a recent sign-in", () => {
  it("offers the confirmation beside the message, only for that failure", async () => {
    flow.grantRole.mockResolvedValue(failed("recent-authentication-required"));
    await mount([grace]);
    expect(button("Confirm it is you")).toBeUndefined();
    await press("Grant staff for grace@example.com");
    expect(lamp()).toBe(outcomeMessage("recent-authentication-required"));
    expect(button("Confirm it is you")).toBeDefined();
    flow.grantRole.mockResolvedValue(failed("not-an-administrator"));
    await press("Grant staff for grace@example.com");
    expect(button("Confirm it is you")).toBeUndefined();
  });

  it("makes the same change again once confirmed, and then says it is done", async () => {
    flow.grantRole
      .mockResolvedValueOnce(failed("recent-authentication-required"))
      .mockResolvedValueOnce({ effective: true, kind: "granted" });
    flow.listPeople.mockResolvedValue([grace, ada]);
    await mount([grace]);
    await press("Grant staff for grace@example.com");
    await press("Confirm it is you");
    expect(flow.grantRole).toHaveBeenCalledTimes(2);
    expect(flow.grantRole).toHaveBeenLastCalledWith(
      expect.any(Function),
      graceId,
      "staff",
    );
    expect(lamp()).toContain("grace@example.com: staff granted.");
    expect(button("Confirm it is you")).toBeUndefined();
  });

  it("repeats a suspension as a suspension, not as a grant", async () => {
    flow.suspendRole
      .mockResolvedValueOnce(failed("recent-authentication-required"))
      .mockResolvedValueOnce({ effective: false, kind: "suspended" });
    await mount([ada]);
    await press("Suspend staff for ada@example.com");
    await press("Confirm it is you");
    expect(flow.suspendRole).toHaveBeenCalledTimes(2);
    expect(flow.grantRole).not.toHaveBeenCalled();
    expect(lamp()).toContain("staff suspended");
  });

  it("asks again if the repeated change still needs confirming, instead of looping", async () => {
    flow.grantRole.mockResolvedValue(failed("recent-authentication-required"));
    await mount([grace]);
    await press("Grant staff for grace@example.com");
    await press("Confirm it is you");
    expect(flow.grantRole).toHaveBeenCalledTimes(2);
    expect(button("Confirm it is you")).toBeDefined();
  });
});
