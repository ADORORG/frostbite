// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ArcadeDialog } from "../src/components/arcade-dialog.tsx";

// jsdom has no modal dialog: these stand in for the browser's, which sets `open` and fires `close` when it closes.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(() => vi.restoreAllMocks());

async function mount(open: boolean, onClose: () => void) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = (next: boolean) =>
    act(async () =>
      root.render(
        <ArcadeDialog onClose={onClose} open={next} title="Choose">
          Any content
        </ArcadeDialog>,
      ),
    );
  await render(open);
  const dialog = container.querySelector("dialog");
  if (dialog === null) throw new Error("Expected a dialog");
  return { container, dialog, render, root };
}

it("opens and closes with the page's state, and names itself by its title", async () => {
  const { dialog, render, root } = await mount(false, () => {});
  expect(dialog.open).toBe(false);
  expect(dialog.getAttribute("aria-labelledby")).toBe(
    dialog.querySelector("h2")?.id,
  );
  await render(true);
  expect(dialog.open).toBe(true);
  await render(false);
  expect(dialog.open).toBe(false);
  await act(async () => root.unmount());
});

it("tells the page it closed however it closed", async () => {
  const onClose = vi.fn();
  const { container, dialog, render, root } = await mount(true, onClose);
  expect(dialog.open).toBe(true);
  // Its own Close button asks the page to close it.
  await act(async () => container.querySelector("button")?.click());
  expect(onClose).toHaveBeenCalledTimes(1);
  // The browser closing it (Escape) fires `close`, which also reaches the page.
  await act(async () => dialog.dispatchEvent(new Event("close")));
  expect(onClose).toHaveBeenCalledTimes(2);
  await render(true);
  await act(async () => root.unmount());
});

it("does not reopen or reclose what is already in the right state", async () => {
  const show = vi.spyOn(HTMLDialogElement.prototype, "showModal");
  const close = vi.spyOn(HTMLDialogElement.prototype, "close");
  const { render, root } = await mount(true, () => {});
  await render(true);
  expect(show).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
