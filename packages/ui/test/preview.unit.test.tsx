// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArcadePreview, ArcadeTicker } from "../src/arcade.ts";

let root: Root | null = null;
afterEach(async () => {
  await act(() => root?.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function motion(reduced: boolean | "unsupported") {
  if (reduced === "unsupported") {
    vi.stubGlobal("matchMedia", undefined);
    return;
  }
  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener: () => undefined,
    matches: query.includes("reduce") && reduced,
    removeEventListener: () => undefined,
  }));
}

async function mount(
  video: string | null,
  image: string | null = "/a/cover.png",
) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() =>
    root?.render(
      <ArcadePreview
        alt="A glacier"
        image={image}
        name="Frost"
        video={video}
      />,
    ),
  );
  return container;
}

describe("a preview", () => {
  it("shows the still with its words, and no clip, when there is no clip", async () => {
    motion(false);
    const container = await mount(null);
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("/a/cover.png");
    expect(image?.getAttribute("alt")).toBe("A glacier");
    expect(container.querySelector("video")).toBeNull();
    expect(container.firstElementChild?.getAttribute("data-playing")).toBe(
      "false",
    );
  });

  it("plays a silent looping clip over the still when motion is welcome", async () => {
    motion(false);
    const container = await mount("/a/cover.mp4");
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toBe("/a/cover.mp4");
    expect(video?.getAttribute("poster")).toBe("/a/cover.png");
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
    expect(video?.getAttribute("aria-hidden")).toBe("true");
    expect(container.firstElementChild?.getAttribute("data-playing")).toBe(
      "true",
    );
  });

  it("keeps to the still when the person asked for less motion", async () => {
    motion(true);
    const container = await mount("/a/cover.mp4");
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("keeps to the still where the browser cannot say what the person prefers", async () => {
    motion("unsupported");
    const container = await mount("/a/cover.mp4");
    expect(container.querySelector("video")).toBeNull();
  });

  it("falls back to the still when the clip cannot be played", async () => {
    motion(false);
    const container = await mount("/a/cover.mp4");
    await act(() =>
      container.querySelector("video")?.dispatchEvent(new Event("error")),
    );
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("draws a stand-in from the name when there is no picture, and hides it from assistive technology", async () => {
    motion(false);
    const container = await mount(null, null);
    const standIn = container.querySelector(".arcade-preview__stand-in");
    expect(standIn?.textContent).toBe("F");
    expect(standIn?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("img")).toBeNull();
    // A clip with no still has no poster to give.
    await act(() =>
      root?.render(
        <ArcadePreview alt="" image={null} name="Frost" video="/a/c.mp4" />,
      ),
    );
    expect(container.querySelector("video")?.hasAttribute("poster")).toBe(
      false,
    );
  });

  it("starts without a clip on the server, which cannot know the person's preference", () => {
    const markup = renderToStaticMarkup(
      <ArcadePreview alt="x" image="/i.png" name="Frost" video="/v.mp4" />,
    );
    expect(markup).not.toContain("<video");
    expect(markup).toContain('src="/i.png"');
  });
});

describe("the ticker", () => {
  it("scrolls its words twice so the loop has no seam, and keeps them from assistive technology", () => {
    const markup = renderToStaticMarkup(
      <ArcadeTicker items={["One", "Two"]} />,
    );
    expect(markup).toContain('aria-hidden="true"');
    expect(markup.match(/<span/gu)).toHaveLength(4);
    expect(markup.indexOf("One")).toBeLessThan(markup.indexOf("Two"));
  });
});
