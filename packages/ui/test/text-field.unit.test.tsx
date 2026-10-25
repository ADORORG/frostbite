// @vitest-environment jsdom
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ArcadeTextField } from "../src/arcade.js";

async function mount(element: ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => root.render(element));
  return container;
}

function control(container: HTMLElement) {
  const found = container.querySelector("input, textarea");
  if (found === null) throw new Error("field control missing");
  return found;
}

// React tracks the value itself, so a typed value is set through the native setter first.
async function type(element: Element, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  await act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("arcade text field", () => {
  it("is labelled by its visible text and reports what is typed", async () => {
    const onChange = vi.fn();
    const container = await mount(
      <ArcadeTextField label="Name" onChange={onChange} value="" />,
    );
    const input = control(container);
    expect(container.querySelector("label")?.textContent).toContain("Name");
    expect(input.tagName).toBe("INPUT");
    await type(input, "First light");
    expect(onChange).toHaveBeenCalledWith("First light");
  });

  it("renders a multi-line field as a textarea", async () => {
    const onChange = vi.fn();
    const container = await mount(
      <ArcadeTextField label="About" multiline onChange={onChange} value="" />,
    );
    const area = control(container);
    expect(area.tagName).toBe("TEXTAREA");
    await type(area, "Hello");
    expect(onChange).toHaveBeenCalledWith("Hello");
  });

  it("asks for a numeric keyboard on a number field and keeps the value a string", async () => {
    const onChange = vi.fn();
    const container = await mount(
      <ArcadeTextField
        label="Supply"
        onChange={onChange}
        type="number"
        value="5"
      />,
    );
    const input = control(container);
    expect(input.getAttribute("type")).toBe("number");
    expect(input.getAttribute("inputmode")).toBe("numeric");
    await type(input, "12");
    expect(onChange).toHaveBeenCalledWith("12");
  });

  it("passes the browser what to fill in and which keyboard to show, and can be an email field", async () => {
    const container = await mount(
      <ArcadeTextField
        autoComplete="email"
        inputMode="email"
        label="Email address"
        onChange={() => undefined}
        type="email"
        value=""
      />,
    );
    const input = control(container);
    expect(input.getAttribute("type")).toBe("email");
    expect(input.getAttribute("autocomplete")).toBe("email");
    expect(input.getAttribute("inputmode")).toBe("email");
  });

  it("lets a text field ask for the numeric keyboard (a code), and a number field be told otherwise", async () => {
    const code = await mount(
      <ArcadeTextField
        inputMode="numeric"
        label="Code"
        onChange={() => undefined}
        value=""
      />,
    );
    expect(control(code).getAttribute("inputmode")).toBe("numeric");
    expect(control(code).getAttribute("type")).toBe("text");
    const plain = await mount(
      <ArcadeTextField label="Name" onChange={() => undefined} value="" />,
    );
    expect(control(plain).hasAttribute("inputmode")).toBe(false);
    expect(control(plain).hasAttribute("autocomplete")).toBe(false);
    const overridden = await mount(
      <ArcadeTextField
        inputMode="text"
        label="Supply"
        onChange={() => undefined}
        type="number"
        value=""
      />,
    );
    expect(control(overridden).getAttribute("inputmode")).toBe("text");
  });

  it("links a hint to the control and marks nothing invalid", async () => {
    const container = await mount(
      <ArcadeTextField
        hint="Up to 120 characters"
        label="Name"
        maxLength={120}
        onChange={() => undefined}
        value=""
      />,
    );
    const input = control(container);
    const note = container.querySelector(".arcade-field__note");
    expect(note?.textContent).toBe("Up to 120 characters");
    expect(input.getAttribute("aria-describedby")).toBe(note?.id);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.getAttribute("maxlength")).toBe("120");
  });

  it("shows an error in words, marks the field invalid, and prefers it over the hint", async () => {
    const container = await mount(
      <ArcadeTextField
        error="Enter a name."
        hint="Up to 120 characters"
        label="Name"
        onChange={() => undefined}
        value=""
      />,
    );
    const input = control(container);
    const note = container.querySelector(".arcade-field__note--error");
    expect(note?.textContent).toBe("Problem: Enter a name.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(note?.id);
    expect(container.textContent).not.toContain("Up to 120");
  });

  it("has no description link when there is neither hint nor error, and can be disabled or required", async () => {
    const container = await mount(
      <ArcadeTextField
        disabled
        label="Name"
        onChange={() => undefined}
        required
        value="x"
      />,
    );
    const input = control(container);
    expect(input.hasAttribute("aria-describedby")).toBe(false);
    expect(input.hasAttribute("disabled")).toBe(true);
    expect(input.hasAttribute("required")).toBe(true);
  });
});
