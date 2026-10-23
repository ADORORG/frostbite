import { act } from "react";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, vi } from "vitest";

const mounted: { container: HTMLElement; root: Root }[] = [];

export async function mount(element: ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(() => root.render(element));
  return container;
}

export async function unmountAll() {
  for (const { container, root } of mounted.splice(0)) {
    await act(() => root.unmount());
    container.remove();
  }
}

// React needs to know it runs under a test harness so `act` batches updates; every mounted tree is
// removed after each test. Call once from a project's setup file.
export function installReactTestEnvironment() {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  afterEach(unmountAll);
}

// jsdom has no modal dialog. This stands in for the browser's, which sets `open` and fires `close` when it closes, so a page that
// opens a dialog can be tested as it is used. Call once from a project's setup file.
export function installDialogShim() {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

export const click = (element: Element | null) => {
  if (element === null) throw new Error("element to click is missing");
  return act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

// Waits for an assertion to hold while the app updates on its own (timers, promises). `act` is
// switched off for the wait, as React's own testing library does, because updates made outside an
// `act` scope are applied immediately instead of being queued until the scope ends.
export async function settle(assertion: () => void, timeout = 3_000) {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false);
  try {
    await vi.waitFor(assertion, { interval: 10, timeout });
  } finally {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  }
  await act(async () => undefined);
}

export const textOf = (container: HTMLElement) => container.textContent ?? "";

export function button(
  container: HTMLElement,
  label: string,
): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === label,
    ) ?? null
  );
}

// The first button whose text matches, for labels that carry a name (such as "Edit First light").
export function buttonMatching(
  container: HTMLElement,
  pattern: RegExp,
): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll("button")].find((candidate) =>
      pattern.test(candidate.textContent ?? ""),
    ) ?? null
  );
}

export async function chooseOption(container: HTMLElement, value: string) {
  const select = container.querySelector("select");
  if (select === null) throw new Error("select is missing");
  await act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// React tracks a control's value itself, so a typed value is set through the native setter first.
export async function typeInto(element: Element, value: string) {
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

// The field whose visible label is `label`, so a test finds a control the way a person does.
export function fieldByLabel(
  container: HTMLElement,
  label: string,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const wrapper = [...container.querySelectorAll("label")].find((candidate) =>
    candidate.textContent?.startsWith(label),
  );
  const control = wrapper?.querySelector("input, textarea, select");
  if (
    !(control instanceof HTMLInputElement) &&
    !(control instanceof HTMLTextAreaElement) &&
    !(control instanceof HTMLSelectElement)
  )
    throw new Error(`no field labelled "${label}"`);
  return control;
}
