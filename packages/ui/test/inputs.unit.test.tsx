// @vitest-environment jsdom
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ArcadeFileDrop,
  ArcadeMediaTile,
  ArcadeSelect,
} from "../src/arcade.js";

async function mount(element: ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => root.render(element));
  return container;
}

async function choose(container: HTMLElement, value: string) {
  const select = container.querySelector("select");
  if (select === null) throw new Error("select missing");
  await act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const png = new File(["x"], "a.png", { type: "image/png" });
const options = [
  { label: "Alpha", value: "alpha" },
  { label: "Beta", value: "beta" },
] as const;

describe("arcade select", () => {
  it("renders a labelled select with the chosen option selected", () => {
    const markup = renderToStaticMarkup(
      <ArcadeSelect
        label="Purpose"
        onChange={() => undefined}
        options={options}
        value="beta"
      />,
    );
    expect(markup).toContain("<span>Purpose</span>");
    expect(markup).toMatch(/<option value="beta"[^>]*selected/);
  });

  it("reports the chosen value, typed to the option set, and ignores unknown values", async () => {
    const onChange = vi.fn();
    const container = await mount(
      <ArcadeSelect
        label="Purpose"
        onChange={onChange}
        options={options}
        value="alpha"
      />,
    );
    await choose(container, "beta");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("beta");
  });

  it("ignores a change to a value that is not one of its options", async () => {
    const onChange = vi.fn();
    const container = await mount(
      <ArcadeSelect
        label="Purpose"
        onChange={onChange}
        options={options}
        value="alpha"
      />,
    );
    await choose(container, "gamma");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("can be disabled", () => {
    expect(
      renderToStaticMarkup(
        <ArcadeSelect
          disabled
          label="x"
          onChange={() => undefined}
          options={options}
          value="alpha"
        />,
      ),
    ).toContain("disabled");
  });
});

describe("arcade file drop", () => {
  const drop = (container: HTMLElement, files: File[]) => {
    const label = container.querySelector("label");
    if (label === null) throw new Error("label missing");
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files } });
    return act(() => {
      label.dispatchEvent(event);
    });
  };

  it("labels a real file input with the accepted types", async () => {
    const container = await mount(
      <ArcadeFileDrop
        accept="image/png"
        hint="PNG only"
        label="Choose"
        onFile={() => undefined}
      />,
    );
    const input = container.querySelector("input");
    expect(input?.type).toBe("file");
    expect(input?.accept).toBe("image/png");
    expect(container.textContent).toContain("Choose");
    expect(container.textContent).toContain("PNG only");
  });

  it("passes a chosen file on and clears the input so the same file can be chosen again", async () => {
    const onFile = vi.fn();
    const container = await mount(
      <ArcadeFileDrop accept="image/png" hint="h" label="l" onFile={onFile} />,
    );
    const input = container.querySelector("input");
    if (input === null) throw new Error("input missing");
    Object.defineProperty(input, "files", { configurable: true, value: [png] });
    await act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onFile).toHaveBeenCalledExactlyOnceWith(png);
    expect(input.value).toBe("");
  });

  it("hands every chosen or dropped file over, in order, when it takes many", async () => {
    const second = new File([new Uint8Array(2)], "b.png", {
      type: "image/png",
    });
    const onFiles = vi.fn();
    const container = await mount(
      <ArcadeFileDrop
        accept="image/png"
        hint="h"
        label="l"
        onFiles={onFiles}
      />,
    );
    const input = container.querySelector("input");
    if (input === null) throw new Error("input missing");
    expect(input.multiple).toBe(true);
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [png, second],
    });
    await act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onFiles).toHaveBeenLastCalledWith([png, second]);
    await drop(container, [second, png]);
    expect(onFiles).toHaveBeenLastCalledWith([second, png]);
    expect(onFiles).toHaveBeenCalledTimes(2);
  });

  it("does not call a many-files handler for an empty choice, and one file at a time stays single", async () => {
    const onFiles = vi.fn();
    const many = await mount(
      <ArcadeFileDrop accept="a" hint="h" label="l" onFiles={onFiles} />,
    );
    await drop(many, []);
    expect(onFiles).not.toHaveBeenCalled();
    const single = await mount(
      <ArcadeFileDrop accept="a" hint="h" label="l" onFile={() => undefined} />,
    );
    expect(single.querySelector("input")?.multiple).toBe(false);
  });

  it("resets the input after every selection, even an empty one, so a file can be chosen twice", async () => {
    const container = await mount(
      <ArcadeFileDrop accept="a" hint="h" label="l" onFile={() => undefined} />,
    );
    const input = container.querySelector("input");
    if (input === null) throw new Error("input missing");
    const writes: string[] = [];
    Object.defineProperty(input, "value", {
      configurable: true,
      get: () => "",
      set: (value: string) => void writes.push(value),
    });
    for (const files of [[png], []]) {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: files,
      });
      await act(() => {
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    expect(writes).toEqual(["", ""]);
  });

  it("ignores a change with no file", async () => {
    const onFile = vi.fn();
    const container = await mount(
      <ArcadeFileDrop accept="a" hint="h" label="l" onFile={onFile} />,
    );
    const input = container.querySelector("input");
    if (input === null) throw new Error("input missing");
    Object.defineProperty(input, "files", { configurable: true, value: [] });
    await act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onFile).not.toHaveBeenCalled();
  });

  it("accepts a dropped file and shows the drag state while hovering", async () => {
    const onFile = vi.fn();
    const container = await mount(
      <ArcadeFileDrop accept="a" hint="h" label="l" onFile={onFile} />,
    );
    const label = container.querySelector("label");
    if (label === null) throw new Error("label missing");
    await act(() => {
      label.dispatchEvent(
        new Event("dragover", { bubbles: true, cancelable: true }),
      );
    });
    expect(label.className).toContain("arcade-file-drop--active");
    await act(() => {
      label.dispatchEvent(new Event("dragleave", { bubbles: true }));
    });
    expect(label.className).not.toContain("--active");
    await drop(container, [png]);
    expect(onFile).toHaveBeenCalledExactlyOnceWith(png);
    await drop(container, []);
    expect(onFile).toHaveBeenCalledOnce();
  });

  it("does nothing while disabled", async () => {
    const onFile = vi.fn();
    const container = await mount(
      <ArcadeFileDrop accept="a" disabled hint="h" label="l" onFile={onFile} />,
    );
    const label = container.querySelector("label");
    if (label === null) throw new Error("label missing");
    expect(label.className).toContain("arcade-file-drop--disabled");
    expect(container.querySelector("input")?.disabled).toBe(true);
    await act(() => {
      label.dispatchEvent(
        new Event("dragover", { bubbles: true, cancelable: true }),
      );
    });
    expect(label.className).not.toContain("--active");
    await drop(container, [png]);
    expect(onFile).not.toHaveBeenCalled();
  });
});

describe("arcade media tile", () => {
  it("renders the image with intrinsic size, alt text, and its caption", () => {
    const markup = renderToStaticMarkup(
      <ArcadeMediaTile
        caption={<b>Caption</b>}
        image={{
          alt: "Cover",
          height: 3,
          src: "https://x.test/a.webp",
          width: 4,
        }}
        placeholder="none"
      />,
    );
    expect(markup).toContain('alt="Cover"');
    expect(markup).toContain('width="4"');
    expect(markup).toContain('height="3"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain("<b>Caption</b>");
    expect(markup).not.toContain("none");
  });

  it("explains an empty tile instead of leaving it blank", () => {
    const markup = renderToStaticMarkup(
      <ArcadeMediaTile caption="c" placeholder="No preview yet" />,
    );
    expect(markup).toContain("No preview yet");
    expect(markup).not.toContain("<img");
  });
});
