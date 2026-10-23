// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { Popover } from "../src/components/popover.tsx";
import { key, press, show } from "./support/render.tsx";

afterEach(() => {
  document.body.replaceChildren();
});

const trigger = (box: HTMLElement) =>
  box.querySelector<HTMLButtonElement>("button.popover__trigger");
const panel = (box: HTMLElement) => box.querySelector(".popover__panel");

it("shows its panel only while open, and says so to assistive technology", async () => {
  const box = await show(
    <Popover label="Wallet" trigger="Open">
      <p>Inside</p>
    </Popover>,
  );
  expect(panel(box)).toBeNull();
  expect(trigger(box)?.getAttribute("aria-expanded")).toBe("false");
  await press(trigger(box));
  expect(panel(box)?.textContent).toBe("Inside");
  expect(panel(box)?.getAttribute("role")).toBe("dialog");
  expect(panel(box)?.getAttribute("aria-label")).toBe("Wallet");
  expect(trigger(box)?.getAttribute("aria-expanded")).toBe("true");
  expect(trigger(box)?.getAttribute("aria-controls")).toBe(panel(box)?.id);
  await press(trigger(box));
  expect(panel(box)).toBeNull();
});

it("closes on Escape and puts focus back on its button, but not on another key", async () => {
  const box = await show(
    <Popover label="Wallet" trigger="Open">
      <button type="button">Inside</button>
    </Popover>,
  );
  await press(trigger(box));
  const inside = panel(box)?.querySelector("button");
  if (!inside) throw new Error("Expected a button in the panel");
  await key(inside, "a");
  expect(panel(box)).not.toBeNull();
  await key(inside, "Escape");
  expect(panel(box)).toBeNull();
  expect(document.activeElement).toBe(trigger(box));
});

it("closes when something else is pressed, and stays open when its own panel is", async () => {
  const box = await show(
    <Popover label="Wallet" trigger="Open">
      <p>Inside</p>
    </Popover>,
  );
  await press(trigger(box));
  await act(async () =>
    panel(box)?.dispatchEvent(new Event("pointerdown", { bubbles: true })),
  );
  expect(panel(box)).not.toBeNull();
  await act(async () =>
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
  );
  expect(panel(box)).toBeNull();
});

it("lets the panel close itself, for a button that finishes the job", async () => {
  const box = await show(
    <Popover label="Menu" trigger="Open">
      {({ close }) => (
        <button onClick={close} type="button">
          Done
        </button>
      )}
    </Popover>,
  );
  await press(trigger(box));
  await press(panel(box)?.querySelector("button") ?? null);
  expect(panel(box)).toBeNull();
});

it("is a plain button, with no menu semantics, when it has no panel", async () => {
  const onTrigger = vi.fn();
  const box = await show(
    <Popover label="Wallet" onTrigger={onTrigger} trigger="Connect">
      {null}
    </Popover>,
  );
  expect(trigger(box)?.hasAttribute("aria-expanded")).toBe(false);
  expect(trigger(box)?.hasAttribute("aria-controls")).toBe(false);
  await press(trigger(box));
  expect(onTrigger).toHaveBeenCalledTimes(1);
  expect(panel(box)).toBeNull();
});

it("names an icon-only button, marks it busy, and passes the page's own state to it", async () => {
  const box = await show(
    <Popover
      busy
      label="Network"
      trigger="●"
      triggerData={{ "data-mismatch": "true" }}
      triggerLabel="Network status"
    >
      <p>Inside</p>
    </Popover>,
  );
  expect(trigger(box)?.getAttribute("aria-label")).toBe("Network status");
  expect(trigger(box)?.getAttribute("aria-busy")).toBe("true");
  expect(trigger(box)?.dataset["mismatch"]).toBe("true");
});

it("says which side it hangs from", async () => {
  const box = await show(
    <Popover align="start" label="Menu" trigger="Open">
      <p>Inside</p>
    </Popover>,
  );
  expect(box.querySelector(".popover")?.getAttribute("data-align")).toBe(
    "start",
  );
});

it("gives its panel the extra room it asks for", async () => {
  const box = await show(
    <Popover label="Fees" panelClassName="popover__panel--wide" trigger="Open">
      <p>Inside</p>
    </Popover>,
  );
  await press(trigger(box));
  expect(panel(box)?.className).toBe("popover__panel popover__panel--wide");
});

it("has no stray class on a panel that asks for none", async () => {
  const box = await show(
    <Popover label="Menu" trigger="Open">
      <p>Inside</p>
    </Popover>,
  );
  await press(trigger(box));
  expect(panel(box)?.className).toBe("popover__panel");
});
