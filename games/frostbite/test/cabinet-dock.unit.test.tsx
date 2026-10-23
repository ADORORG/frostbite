// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { cabinetDock, cabinetDockId } from "../src/cabinet/dock.ts";
import { mountIceField } from "../src/ice-field/mount.tsx";
import { mountSatSnake } from "../src/snake/mount.tsx";

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(() => {
  document.body.replaceChildren();
});

const host = { milestone: () => undefined };

describe("the row the cabinets' launchers sit in", () => {
  it("is made once, on the page, and found again by the next one that asks", () => {
    const first = cabinetDock(document);
    expect(first.id).toBe(cabinetDockId);
    expect(first.className).toBe("cabinet-dock");
    expect(first.parentElement).toBe(document.body);
    expect(cabinetDock(document)).toBe(first);
    expect(document.querySelectorAll(`#${cabinetDockId}`)).toHaveLength(1);
  });

  it("holds both cabinets, the ice field first, so their launchers sit side by side and cannot overlap", async () => {
    let leave: (() => void)[] = [];
    await act(async () => {
      leave = [mountIceField(host), mountSatSnake(host)];
    });
    const dock = document.getElementById(cabinetDockId);
    expect([...(dock?.children ?? [])].map((child) => child.id)).toEqual([
      "ice-field-root",
      "sat-snake-root",
    ]);
    expect(document.querySelectorAll(`#${cabinetDockId}`)).toHaveLength(1);
    expect(document.body.children).toHaveLength(1);
    expect(dock?.textContent).toBe("Ice fieldSat snake");
    await act(async () => leave.forEach((unmount) => unmount()));
    expect(document.getElementById("ice-field-root")).toBeNull();
    expect(document.getElementById("sat-snake-root")).toBeNull();
  });
});
