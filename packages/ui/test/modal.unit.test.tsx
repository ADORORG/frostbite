// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ArcadeModal } from "../src/components/arcade-modal.tsx";

it("disables its trigger before hydration and gives each modal a distinct label", () => {
  const html = renderToStaticMarkup(
    <>
      <ArcadeModal title="First" triggerLabel="Open first">
        First content
      </ArcadeModal>
      <ArcadeModal title="Second" triggerLabel="Open second">
        Second content
      </ArcadeModal>
    </>,
  );
  const container = document.createElement("div");
  container.innerHTML = html;
  expect(container.querySelector("button")?.disabled).toBe(true);
  const dialogs = container.querySelectorAll("dialog");
  expect(dialogs[0]?.getAttribute("aria-labelledby")).not.toBe(
    dialogs[1]?.getAttribute("aria-labelledby"),
  );
});

it("opens and closes arbitrary modal content after hydration", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <ArcadeModal title="Reusable" triggerLabel="Open">
          Any feature
        </ArcadeModal>,
      ),
    );
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("Expected modal");
    const showModal = vi.fn();
    const close = vi.fn();
    Object.defineProperty(dialog, "showModal", { value: showModal });
    Object.defineProperty(dialog, "close", { value: close });
    const buttons = container.querySelectorAll("button");
    expect(buttons[0]?.disabled).toBe(false);
    await act(async () => buttons[0]?.click());
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog.textContent).toContain("Any feature");
    await act(async () => buttons[1]?.click());
    expect(close).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
  }
});
