// @vitest-environment jsdom
import { outcomeMessage } from "@ador/shared/account-outcomes";
import { failed } from "../src/client/outcome.ts";
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

const flow = vi.hoisted(() => ({
  findPeople: vi.fn(),
  grantRole: vi.fn(),
  listPeople: vi.fn(),
  suspendRole: vi.fn(),
}));
vi.mock("../src/roles/roles-flow.ts", () => flow);
import { RolesPanel } from "../src/roles/roles-panel.tsx";
import type { Person } from "../src/roles/roles-flow.ts";

const adaId = createUuidV7();
const graceId = createUuidV7();
const ada: Person = {
  label: "ada@example.com",
  roles: [
    { effective: true, role: "admin", status: "active" },
    { effective: false, role: "staff", status: "active" },
    { effective: false, role: "reviewer", status: "suspended" },
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
function type(value: string) {
  const field = container.querySelector("input");
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
const search = async (query: string) => {
  type(query);
  await act(async () => {
    container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

describe("who holds roles", () => {
  it("says so when nobody does", async () => {
    await mount([]);
    expect(container.textContent).toContain("Nobody holds a platform role.");
  });

  it("shows every role of each person: working, recorded but not working yet, suspended and not held", async () => {
    await mount([ada, grace]);
    const text = container.textContent ?? "";
    expect(text).toContain("admin (manages who holds roles): active");
    expect(text).toContain(
      "staff (operates the platform): active, not working yet",
    );
    expect(text).toContain(
      "reviewer (decides on submissions and applications): suspended",
    );
    expect(text).toContain("admin (manages who holds roles): not held");
  });

  it("offers the action that fits each state: suspend what is active, reinstate what is suspended, grant what is not held", async () => {
    await mount([ada, grace]);
    expect(button("Suspend admin for ada@example.com")).toBeDefined();
    expect(button("Reinstate reviewer for ada@example.com")).toBeDefined();
    expect(button("Grant staff for grace@example.com")).toBeDefined();
    expect(button("Grant admin for ada@example.com")).toBeUndefined();
  });
});

describe("changing a role", () => {
  it("grants, reads the list again, and says it is done only then", async () => {
    flow.grantRole.mockResolvedValue({ effective: true, kind: "granted" });
    flow.listPeople.mockResolvedValue([grace, ada]);
    await mount([ada, grace]);
    await press("Grant staff for grace@example.com");
    expect(flow.grantRole).toHaveBeenCalledWith(
      expect.any(Function),
      graceId,
      "staff",
    );
    expect(flow.listPeople).toHaveBeenCalledOnce();
    expect(lamp()).toContain("grace@example.com: staff granted.");
    expect(container.querySelector(".status-lamp--ready")).not.toBeNull();
  });

  it("says a granted role does not work yet when the account lacks the wallet it needs", async () => {
    flow.grantRole.mockResolvedValue({ effective: false, kind: "granted" });
    await mount([grace]);
    await press("Grant admin for grace@example.com");
    expect(lamp()).toContain("recorded but does not work yet");
    expect(lamp()).toContain("needs a wallet");
    expect(container.querySelector(".status-lamp--attention")).not.toBeNull();
  });

  it("suspends and reinstates through the same steps", async () => {
    flow.suspendRole.mockResolvedValue({ effective: false, kind: "suspended" });
    flow.grantRole.mockResolvedValue({ effective: true, kind: "reinstated" });
    await mount([ada]);
    await press("Suspend staff for ada@example.com");
    expect(flow.suspendRole).toHaveBeenCalledWith(
      expect.any(Function),
      adaId,
      "staff",
    );
    expect(lamp()).toContain("ada@example.com: staff suspended.");
    await press("Reinstate reviewer for ada@example.com");
    expect(flow.grantRole).toHaveBeenCalledWith(
      expect.any(Function),
      adaId,
      "reviewer",
    );
    expect(lamp()).toContain("reviewer reinstated");
  });

  it("says nothing changed when the person already had it", async () => {
    flow.grantRole.mockResolvedValue({ effective: true, kind: "unchanged" });
    await mount([grace]);
    await press("Grant staff for grace@example.com");
    expect(lamp()).toContain("already had that: nothing changed");
  });

  it.each([
    "not-an-administrator",
    "last-administrator",
    "network",
    "signed-out",
    "no-such-account",
  ] as const)(
    "keeps the list and says why when the change fails as %s",
    async (outcome) => {
      flow.suspendRole.mockResolvedValue(failed(outcome));
      await mount([ada]);
      await press("Suspend admin for ada@example.com");
      expect(lamp()).toBe(outcomeMessage(outcome));
      expect(
        container.querySelector(".status-lamp--unavailable"),
      ).not.toBeNull();
      expect(flow.listPeople).not.toHaveBeenCalled();
    },
  );

  it("says the change was made but the list could not be refreshed, instead of claiming a clean success", async () => {
    flow.grantRole.mockResolvedValue({ effective: true, kind: "granted" });
    flow.listPeople.mockRejectedValue(new Error("down"));
    await mount([grace]);
    await press("Grant staff for grace@example.com");
    expect(lamp()).toContain("grace@example.com: staff granted.");
    expect(lamp()).toContain("could not be refreshed");
    expect(container.querySelector(".status-lamp--ready")).toBeNull();
  });
});

describe("finding a person", () => {
  it("shows the account the typed address names, with the actions for it", async () => {
    flow.findPeople.mockResolvedValue([grace]);
    await mount([ada]);
    await search("grace@example.com");
    expect(flow.findPeople).toHaveBeenCalledWith(
      expect.any(Function),
      "grace@example.com",
    );
    expect(lamp()).toContain("One account matches");
    expect(
      container.querySelector('ul[aria-label="Search results"]')?.textContent,
    ).toContain("grace@example.com");
  });

  it("says how many matched, and that only an exact match is found when none did", async () => {
    flow.findPeople.mockResolvedValue([grace, ada]);
    await mount([]);
    await search("x");
    expect(lamp()).toContain("2 accounts match");
    flow.findPeople.mockResolvedValue([]);
    await search("nobody@example.com");
    expect(lamp()).toContain("Nobody has that address");
    expect(
      container.querySelector('ul[aria-label="Search results"]'),
    ).toBeNull();
  });

  it("says the search could not be completed", async () => {
    flow.findPeople.mockRejectedValue(new Error("down"));
    await mount([]);
    await search("x");
    expect(lamp()).toContain("could not be completed");
  });

  it("reads the results again after a change made from them", async () => {
    flow.findPeople.mockResolvedValue([grace]);
    flow.grantRole.mockResolvedValue({ effective: true, kind: "granted" });
    await mount([ada]);
    await search("grace@example.com");
    await press("Grant staff for grace@example.com");
    expect(flow.findPeople).toHaveBeenCalledTimes(2);
  });
});
