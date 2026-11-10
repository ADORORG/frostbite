// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeMoment, fakeStage } from "./support/view.ts";

const made = vi.hoisted(() => ({ stage: null as unknown }));
vi.mock("../src/screen/stage.ts", async (original) => ({
  ...(await original<typeof import("../src/screen/stage.ts")>()),
  createStage: () => made.stage,
}));
const { createView } = await import("../src/view.ts");

afterEach(() => vi.restoreAllMocks());

const parts = () => ({
  canvas: document.createElement("canvas"),
  moment: fakeMoment(),
  ratio: () => 2,
  room: () => ({ height: 0.5, x: 0.3, y: 0.5 }),
  touch: false,
});

describe("what draws the game", () => {
  it("is the flat screen where there is no WebGL, with the run drawn the same way", async () => {
    made.stage = null;
    const given = parts();
    vi.spyOn(given.canvas, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 100, 50),
    );
    given.canvas.toDataURL = () => "data:,flat";
    const view = await createView(given);
    expect(view.depth).toBe(false);
    expect(given.canvas.width).toBe(200);
    view.select(2);
    view.begin(2);
    view.show(1 / 60, null);
    view.resize();
    expect(view.snapshot()).toBe("data:,flat");
  });

  it("is the 3D screen where there is, which tells the stage how long each frame took", async () => {
    const { renderer, stage } = fakeStage();
    made.stage = stage;
    const view = await createView(parts());
    expect(view.depth).toBe(true);
    view.select(1);
    view.show(1 / 60, null);
    view.begin(1);
    view.resize();
    expect(renderer.render).toHaveBeenCalled();
    expect(renderer.setSize).toHaveBeenCalled();
    expect(view.snapshot()).toMatch(/^data:image\/png/u);
  }, 60_000);
});
