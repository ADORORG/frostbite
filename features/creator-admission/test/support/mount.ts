import type { ReactElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

export async function mount(element: ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => root.render(element));
  return {
    container,
    unmount: async () => {
      await act(() => root.unmount());
      container.remove();
    },
  };
}

export async function click(element: Element) {
  await act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

export function button(container: HTMLElement, text: string): HTMLElement {
  const found = [...container.querySelectorAll<HTMLElement>("button")].find(
    (candidate) => candidate.textContent?.startsWith(text),
  );
  if (found === undefined) throw new Error(`No button "${text}"`);
  return found;
}

export async function choose(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;
  if (setter === undefined) throw new Error("No value setter");
  await act(() => {
    setter.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
