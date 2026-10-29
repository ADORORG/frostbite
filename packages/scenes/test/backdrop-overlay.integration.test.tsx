// @vitest-environment jsdom

import { click, installReactTestEnvironment, mount } from "@ador/test-kit/dom";
import { act, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  SceneBackdrop,
  SceneOverlay,
  ScenesProvider,
} from "../src/react/index.ts";
import { blocks } from "../src/library/blocks.ts";
import { runner } from "../src/library/runner.ts";
import { installBrowser } from "./support/browser.ts";
import {
  canvases,
  frameAt as frameAtOf,
  stage,
  toggle,
} from "./support/stage.tsx";

installReactTestEnvironment();
const browser = installBrowser();
const frameAt = frameAtOf(browser);

describe("a backdrop", () => {
  it("draws a still frame at once, then moves, and stops when the switch is turned off", async () => {
    const container = await mount(stage(<SceneBackdrop sceneId="runner" />));
    const [canvas] = canvases(container);
    expect(canvas).toBeDefined();
    expect(browser.frames(canvas ?? null)).toBe(1);
    await frameAt(1000);
    expect(browser.frames(canvas ?? null)).toBe(2);
    await frameAt(1040);
    await frameAt(1080);
    expect(browser.frames(canvas ?? null)).toBe(4);
    click(toggle(container));
    await act(async () => undefined);
    const stilled = browser.frames(canvas ?? null);
    await frameAt(2000);
    await frameAt(2100);
    expect(browser.frames(canvas ?? null)).toBe(stilled);
  });

  it("draws nothing new while the tab is hidden, and goes on when it is shown", async () => {
    const container = await mount(stage(<SceneBackdrop sceneId="runner" />));
    const [canvas] = canvases(container);
    const before = browser.frames(canvas ?? null);
    browser.hidden(true);
    await frameAt(1000);
    await frameAt(1100);
    expect(browser.frames(canvas ?? null)).toBe(before);
    browser.hidden(false);
    await frameAt(1200);
    expect(browser.frames(canvas ?? null)).toBe(before + 1);
  });

  it("takes the scene it is told, and a random one for a name it does not know", async () => {
    const named = await mount(stage(<SceneBackdrop sceneId="blocks" />));
    await frameAt(1000);
    expect(
      browser.surfaceOf(canvases(named)[0] ?? null)?.drawn[0]?.height,
    ).toBe(90);
    const unknown = await mount(stage(<SceneBackdrop sceneId="nope" />));
    expect(canvases(unknown)).toHaveLength(1);
  });

  it("gives two backdrops on one page different scenes while there are others", async () => {
    const container = await mount(
      stage(
        <>
          <SceneBackdrop />
          <SceneBackdrop />
        </>,
      ),
    );
    await frameAt(1000);
    const first = canvases(container).map(
      (canvas) => browser.surfaceOf(canvas)?.drawn[0]?.height,
    );
    expect(first).toHaveLength(2);
    expect(new Set(first).size).toBe(2);
  });

  it("stops drawing a backdrop that is taken off the page while the page stays", async () => {
    function Switch() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button id="hide" onClick={() => setShown(false)} type="button">
            hide
          </button>
          {shown ? <SceneBackdrop sceneId="runner" /> : null}
        </>
      );
    }
    const container = await mount(stage(<Switch />));
    const [canvas] = canvases(container);
    await frameAt(1000);
    const before = browser.frames(canvas ?? null);
    click(container.querySelector("#hide"));
    await act(async () => undefined);
    await frameAt(1100);
    await frameAt(1200);
    expect(canvases(container)).toHaveLength(0);
    expect(browser.frames(canvas ?? null)).toBe(before);
  });

  it("stops drawing a backdrop taken off the page, when the browser reports visibility too", async () => {
    const observers = browser.observe();
    function Switch() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button id="hide" onClick={() => setShown(false)} type="button">
            hide
          </button>
          {shown ? <SceneBackdrop sceneId="runner" /> : null}
        </>
      );
    }
    const container = await mount(stage(<Switch />));
    const [canvas] = canvases(container);
    await act(async () => observers[0]?.emit(true));
    await frameAt(1000);
    const before = browser.frames(canvas ?? null);
    expect(before).toBeGreaterThan(0);
    click(container.querySelector("#hide"));
    await act(async () => undefined);
    await frameAt(1100);
    await frameAt(1200);
    expect(browser.frames(canvas ?? null)).toBe(before);
  });

  it("keeps moving whatever the cap does to the cards around it", async () => {
    const container = await mount(
      stage(
        <>
          {Array.from({ length: 8 }, (_, at) => (
            <SceneOverlay key={at} sceneId="runner" seed={String(at)} />
          ))}
          <SceneBackdrop sceneId="runner" />
        </>,
      ),
    );
    await frameAt(1000);
    await frameAt(1100);
    const all = canvases(container);
    expect(browser.frames(all.at(-1) ?? null)).toBeGreaterThanOrEqual(3);
    expect(all.filter((canvas) => browser.frames(canvas) >= 3)).toHaveLength(7);
  });

  it("is the plain box on the server, with no canvas, so the first paint matches", () => {
    const html = renderToString(
      <ScenesProvider list={[blocks, runner]}>
        <SceneBackdrop />
      </ScenesProvider>,
    );
    expect(html).toContain("scene-backdrop");
    expect(html).not.toContain("<canvas");
  });
});

describe("an overlay", () => {
  it("shows the same scene for the same id on every visit", async () => {
    const heights = async (seed: string) => {
      const container = await mount(stage(<SceneOverlay seed={seed} />));
      await frameAt(1000);
      return browser.surfaceOf(canvases(container)[0] ?? null)?.drawn[0]
        ?.height;
    };
    expect(await heights("frostbite")).toBe(await heights("frostbite"));
  });

  it("gives different ids different scenes, spread over the list", async () => {
    const seen = new Set<number | undefined>();
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const container = await mount(stage(<SceneOverlay seed={seed} />));
      await frameAt(1000);
      seen.add(
        browser.surfaceOf(canvases(container)[0] ?? null)?.drawn[0]?.height,
      );
    }
    expect(seen.size).toBe(2);
  });

  it("takes the scene a card names over the one its id would give", async () => {
    const container = await mount(
      stage(<SceneOverlay sceneId="blocks" seed="anything" />),
    );
    await frameAt(1000);
    expect(
      browser.surfaceOf(canvases(container)[0] ?? null)?.drawn[0]?.height,
    ).toBe(90);
  });

  it("draws nothing when there are no scenes", async () => {
    const container = await mount(stage(<SceneOverlay seed="x" />, []));
    expect(canvases(container)).toHaveLength(0);
  });

  it("lets no more than the cap move at once; the rest show a still", async () => {
    const container = await mount(
      stage(
        <>
          {Array.from({ length: 9 }, (_, at) => (
            <SceneOverlay key={at} sceneId="runner" seed={String(at)} />
          ))}
        </>,
      ),
    );
    await frameAt(1000);
    await frameAt(1100);
    const moved = canvases(container).filter(
      (canvas) => browser.frames(canvas) >= 2,
    );
    expect(moved).toHaveLength(6);
    expect(
      canvases(container).every((canvas) => browser.frames(canvas) >= 1),
    ).toBe(true);
  });
});

describe("failures", () => {
  it("draws nothing, and does not fail, when the canvas has no drawing context", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const container = await mount(stage(<SceneBackdrop sceneId="runner" />));
    await frameAt(1000);
    expect(canvases(container)).toHaveLength(1);
    expect(browser.surfaceOf(canvases(container)[0] ?? null)).toBeUndefined();
  });

  it("is refused with a plain message when there are no scenes to take", async () => {
    const quiet = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    await expect(mount(stage(<SceneBackdrop />, []))).rejects.toThrow(
      "no scenes",
    );
    quiet.mockRestore();
  });
});

describe("a scene shown on its own", () => {
  // Which colours a scene uses is its own and does not change as time passes, so it tells one scene from another.
  const coloursOf = (container: HTMLElement) =>
    [...new Set(drawnOf(container)?.map(({ colour }) => colour))].sort().join();
  const drawnOf = (container: HTMLElement) =>
    browser.surfaceOf(canvases(container)[0] ?? null)?.drawn;

  it("is drawn by the stage it is given to, and nothing is drawn before there is one", async () => {
    const { SceneStage } = await import("../src/react/index.ts");
    const empty = await mount(stage(<SceneStage scene={null} />));
    expect(canvases(empty)).toHaveLength(0);
    expect(
      empty.querySelector(".scene-backdrop")?.getAttribute("aria-hidden"),
    ).toBe("true");
    const shown = await mount(stage(<SceneStage scene={blocks} />));
    await frameAt(1000);
    expect(canvases(shown)).toHaveLength(1);
    expect(drawnOf(shown)?.length).toBeGreaterThan(0);
  });

  it("follows the scene it is told to show as that changes", async () => {
    function Switch() {
      const [id, setId] = useState("blocks");
      return (
        <>
          <button id="go" onClick={() => setId("runner")} type="button">
            go
          </button>
          <SceneBackdrop sceneId={id} />
        </>
      );
    }
    const container = await mount(stage(<Switch />));
    await frameAt(1000);
    const first = coloursOf(container);
    click(container.querySelector("#go"));
    await act(async () => undefined);
    await frameAt(1100);
    expect(canvases(container)).toHaveLength(1);
    expect(coloursOf(container)).not.toBe(first);
  });

  it("plays at full strength as a card's picture when asked, and blended over one otherwise", async () => {
    const art = await mount(stage(<SceneOverlay art seed="x" />));
    expect(art.querySelector(".scene-overlay")?.className).toContain(
      "scene-overlay--art",
    );
    const blended = await mount(stage(<SceneOverlay seed="x" />));
    expect(blended.querySelector(".scene-overlay")?.className).not.toContain(
      "--art",
    );
  });
});
