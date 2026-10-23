// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTheatre } from "../src/ui/use-theatre.ts";

function Probe() {
  const theatre = useTheatre();
  return (
    <button onClick={theatre.toggle} type="button">
      {theatre.on ? "on" : "off"}
    </button>
  );
}

const flag = () => document.documentElement.dataset["theatre"];
let host: HTMLElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
  delete document.documentElement.dataset["theatre"];
});

async function mount() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<Probe />));
  return {
    button: () => host?.querySelector("button") ?? null,
    root,
  };
}

describe("theatre mode", () => {
  it("marks the page while it is on, and takes the mark off when it is turned off", async () => {
    const view = await mount();
    expect(flag()).toBeUndefined();
    await act(async () => view.button()?.click());
    expect(view.button()?.textContent).toBe("on");
    expect(flag()).toBe("true");
    await act(async () => view.button()?.click());
    expect(view.button()?.textContent).toBe("off");
    expect(flag()).toBeUndefined();
  });

  it("is left with Escape and with nothing else", async () => {
    const view = await mount();
    await act(async () => view.button()?.click());
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })),
    );
    expect(flag()).toBe("true");
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(flag()).toBeUndefined();
    expect(view.button()?.textContent).toBe("off");
  });

  it("puts the page back, and stops listening, when what used it goes away while it is on", async () => {
    const view = await mount();
    await act(async () => view.button()?.click());
    expect(flag()).toBe("true");
    const removed = vi.spyOn(document, "removeEventListener");
    await act(async () => view.root.unmount());
    expect(flag()).toBeUndefined();
    expect(removed).toHaveBeenCalledWith("keydown", expect.any(Function));
    removed.mockRestore();
    // A later Escape does nothing to a page that is not in theatre.
    document.documentElement.dataset["theatre"] = "other";
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(flag()).toBe("other");
  });

  it("does not mark the page until it is turned on", async () => {
    await mount();
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(flag()).toBeUndefined();
  });
});
