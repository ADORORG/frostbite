import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

// Draws a piece of the interface into the page and hands back where it is, for a test to look at and press.
export async function show(content: ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => createRoot(container).render(content));
  return container;
}

export async function press(target: Element | null): Promise<void> {
  if (target === null) throw new Error("Nothing to press.");
  await act(async () =>
    target.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
}

export async function key(target: Element, name: string): Promise<void> {
  await act(async () =>
    target.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: name }),
    ),
  );
}
