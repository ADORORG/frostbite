// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../src/arcade.ts";

let root: Root | null = null;
let rowsHigh = 95;
const watchers: (() => void)[] = [];
const disconnect = vi.fn();

afterEach(async () => {
  await act(() => root?.unmount());
  document.body.innerHTML = "";
  watchers.length = 0;
  disconnect.mockClear();
  vi.unstubAllGlobals();
});

async function mount() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const height = this.tagName === "HEADER" ? rowsHigh : 0;
      return { height } as DOMRect;
    },
  );
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() =>
    root?.render(
      <AppShell homeHref="#top" navigation={[]}>
        <h1>Page</h1>
      </AppShell>,
    ),
  );
  return document.querySelector<HTMLElement>(".app-shell");
}

const heightOf = (shell: HTMLElement | null) =>
  shell?.style.getPropertyValue("--arcade-header-height");

describe("the header height", () => {
  it("is set on the shell to what the header truly is, and follows it when it wraps or unwraps", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          watchers.push(callback);
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const shell = await mount();
    expect(heightOf(shell)).toBe("95px");
    rowsHigh = 60;
    await act(() => watchers.forEach((notify) => notify()));
    expect(heightOf(shell)).toBe("60px");
    await act(() => root?.unmount());
    root = null;
    expect(disconnect).toHaveBeenCalled();
    expect(heightOf(shell)).toBe("");
  });

  it("follows the window alone where the page has no observer of boxes", async () => {
    rowsHigh = 95;
    vi.stubGlobal("ResizeObserver", undefined);
    const shell = await mount();
    expect(heightOf(shell)).toBe("95px");
    rowsHigh = 72;
    await act(() => window.dispatchEvent(new Event("resize")));
    expect(heightOf(shell)).toBe("72px");
  });

  it("leaves the token alone when the header has no height to measure", async () => {
    rowsHigh = 0;
    vi.stubGlobal("ResizeObserver", undefined);
    expect(heightOf(await mount())).toBe("");
  });
});
