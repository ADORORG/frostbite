// @vitest-environment jsdom

import {
  click,
  installReactTestEnvironment,
  mount,
} from "@frostbite/test-kit/dom";
import { act, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { runner } from "../src/library/runner.ts";
import { blocks } from "../src/library/blocks.ts";
import {
  AnimationToggle,
  SceneBackdrop,
  SceneOverlay,
  ScenesProvider,
} from "../src/react/index.ts";
import { videoFiles } from "../src/video/index.ts";
import { installBrowser } from "./support/browser.ts";
import { canvases } from "./support/stage.tsx";

installReactTestEnvironment();
installBrowser();

const base = "/media/scenes";
const withoutCanvas = () =>
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
const page = (children: React.ReactNode, videoBase: string | null = base) => (
  <ScenesProvider list={[blocks, runner]} videoBase={videoBase}>
    <AnimationToggle />
    <div style={{ position: "relative" }}>{children}</div>
  </ScenesProvider>
);
const settle = () => act(async () => undefined);

describe("a browser that cannot draw a scene", () => {
  it("plays the scene's video, silent and looping, with the still as its poster and both formats on offer", async () => {
    withoutCanvas();
    const container = await mount(page(<SceneBackdrop sceneId="runner" />));
    await settle();
    const files = videoFiles("runner");
    const video = container.querySelector("video");
    expect(canvases(container)).toHaveLength(0);
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.getAttribute("aria-hidden")).toBe("true");
    expect(video?.getAttribute("poster")).toBe(`${base}/${files.poster}`);
    const sources = [...(video?.querySelectorAll("source") ?? [])].map(
      (source) => [source.getAttribute("src"), source.getAttribute("type")],
    );
    expect(sources).toEqual([
      [`${base}/${files.webm}`, "video/webm"],
      [`${base}/${files.mp4}`, "video/mp4"],
    ]);
  });

  it("works on a card overlay too", async () => {
    withoutCanvas();
    const container = await mount(
      page(<SceneOverlay sceneId="blocks" seed="x" />),
    );
    await settle();
    expect(container.querySelector(".scene-overlay video")).not.toBeNull();
  });

  it("shows only the still while animation is off, and plays again when it is turned on", async () => {
    withoutCanvas();
    const container = await mount(page(<SceneBackdrop sceneId="runner" />));
    await settle();
    click(container.querySelector("button"));
    await settle();
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      `${base}/${videoFiles("runner").poster}`,
    );
    click(container.querySelector("button"));
    await settle();
    expect(container.querySelector("video")).not.toBeNull();
  });

  it("falls back to the still when the video cannot be loaded, and to nothing when the still cannot either", async () => {
    withoutCanvas();
    const container = await mount(page(<SceneBackdrop sceneId="runner" />));
    await settle();
    await act(async () =>
      container.querySelector("video")?.dispatchEvent(new Event("error")),
    );
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")).not.toBeNull();
    await act(async () =>
      container.querySelector("img")?.dispatchEvent(new Event("error")),
    );
    expect(container.querySelector("img, video")).toBeNull();
  });

  it("starts clean for the next scene after one failed", async () => {
    withoutCanvas();
    function Switch() {
      const [id, setId] = useState("runner");
      return (
        <>
          <button id="go" onClick={() => setId("blocks")} type="button" />
          <SceneBackdrop sceneId={id} />
        </>
      );
    }
    const container = await mount(page(<Switch />));
    await settle();
    await act(async () =>
      container.querySelector("video")?.dispatchEvent(new Event("error")),
    );
    expect(container.querySelector("video")).toBeNull();
    click(container.querySelector("#go"));
    await settle();
    expect(
      container.querySelector("video source")?.getAttribute("src"),
    ).toContain("blocks.webm");
  });

  it("plays only while it is on screen", async () => {
    withoutCanvas();
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    const watchers: Array<
      (entries: Array<{ isIntersecting: boolean }>) => void
    > = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(
          callback: (entries: Array<{ isIntersecting: boolean }>) => void,
        ) {
          watchers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    await mount(page(<SceneBackdrop sceneId="runner" />));
    await settle();
    watchers.at(-1)?.([{ isIntersecting: true }]);
    expect(play).toHaveBeenCalledTimes(1);
    watchers.at(-1)?.([{ isIntersecting: false }]);
    expect(pause).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("shows nothing when the app serves no videos", async () => {
    withoutCanvas();
    const container = await mount(
      page(<SceneBackdrop sceneId="runner" />, null),
    );
    await settle();
    expect(container.querySelector("video, img, canvas")).toBeNull();
  });
});

describe("the server's page", () => {
  it("is the canvas one, which is what a browser that can draw adopts, so nothing disagrees when it loads", () => {
    const html = renderToString(
      page(<SceneOverlay sceneId="blocks" seed="x" />),
    );
    expect(html).toContain("<canvas");
    expect(html).not.toContain("<video");
  });
});

describe("a browser that can", () => {
  it("draws on a canvas and never fetches a video, even when the app serves them", async () => {
    const container = await mount(page(<SceneBackdrop sceneId="runner" />));
    await settle();
    expect(canvases(container)).toHaveLength(1);
    expect(container.querySelector("video, img")).toBeNull();
  });
});
