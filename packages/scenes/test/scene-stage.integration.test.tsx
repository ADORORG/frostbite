// @vitest-environment jsdom

import {
  click,
  installReactTestEnvironment,
  mount,
} from "@frostbite/test-kit/dom";
import { act, useState } from "react";
import { describe, expect, it } from "vitest";

import { SceneBackdrop, SceneOverlay, SceneStage } from "../src/react/index.ts";
import { blocks } from "../src/library/blocks.ts";
import { installBrowser } from "./support/browser.ts";
import { canvases, frameAt as frameAtOf, stage } from "./support/stage.tsx";

installReactTestEnvironment();
const browser = installBrowser();
const frameAt = frameAtOf(browser);

describe("a scene shown on its own", () => {
  // Which colours a scene uses is its own and does not change as time passes, so it tells one scene from another.
  const coloursOf = (container: HTMLElement) =>
    [...new Set(drawnOf(container)?.map(({ colour }) => colour))].sort().join();
  const drawnOf = (container: HTMLElement) =>
    browser.surfaceOf(canvases(container)[0] ?? null)?.drawn;

  it("is drawn by the stage it is given to, and nothing is drawn before there is one", async () => {
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
