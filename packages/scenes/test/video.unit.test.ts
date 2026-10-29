import { describe, expect, it } from "vitest";

import { palette, sceneHeight, sceneWidth } from "../src/engine/index.ts";
import { scenes } from "../src/library/index.ts";
import {
  createRaster,
  framePlan,
  parseColour,
  videoFiles,
  videoSpec,
} from "../src/video/index.ts";

const at = (pixels: Uint8Array, x: number, y: number) => [
  ...pixels.slice((y * sceneWidth + x) * 4, (y * sceneWidth + x) * 4 + 4),
];

describe("reading a palette colour", () => {
  it("reads hex and the translucent rgb form, and nothing else", () => {
    expect(parseColour("#38e8ff")).toEqual({
      alpha: 1,
      blue: 255,
      green: 232,
      red: 56,
    });
    expect(parseColour(palette.shade)).toEqual({
      alpha: 0.3,
      blue: 0,
      green: 0,
      red: 0,
    });
    expect(parseColour("rgb(1 2 3)").alpha).toBe(1);
    expect(() => parseColour("red")).toThrow('cannot read the colour "red"');
    expect(() => parseColour("#fff")).toThrow("cannot read");
  });
});

describe("the in-memory surface", () => {
  it("fills a rectangle in an opaque colour and leaves the rest empty", () => {
    const { pixels, surface } = createRaster();
    surface.fillStyle = "#ff0000";
    surface.fillRect(2, 3, 4, 2);
    expect(at(pixels, 2, 3)).toEqual([255, 0, 0, 255]);
    expect(at(pixels, 5, 4)).toEqual([255, 0, 0, 255]);
    expect(at(pixels, 6, 4)).toEqual([0, 0, 0, 0]);
    expect(at(pixels, 2, 5)).toEqual([0, 0, 0, 0]);
    expect(at(pixels, 1, 3)).toEqual([0, 0, 0, 0]);
  });

  it("blends a translucent colour over what is there, by its alpha and the surface's opacity", () => {
    const { pixels, surface } = createRaster();
    surface.fillStyle = "#ffffff";
    surface.fillRect(0, 0, 1, 1);
    surface.fillStyle = "rgb(0 0 0 / 50%)";
    surface.fillRect(0, 0, 1, 1);
    expect(at(pixels, 0, 0)).toEqual([128, 128, 128, 255]);
    surface.globalAlpha = 0.5;
    surface.fillStyle = "#000000";
    surface.fillRect(1, 0, 1, 1);
    expect(at(pixels, 1, 0)).toEqual([0, 0, 0, 128]);
    surface.globalAlpha = 1;
    surface.fillStyle = "#ff0000";
    surface.fillRect(1, 0, 1, 1);
    expect(at(pixels, 1, 0)).toEqual([255, 0, 0, 255]);
  });

  it("leaves an empty pixel empty when nothing visible is drawn on it", () => {
    const { pixels, surface } = createRaster();
    surface.fillStyle = "rgb(9 9 9 / 0%)";
    surface.fillRect(0, 0, 1, 1);
    expect(at(pixels, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it("clips to the picture and snaps to whole pixels", () => {
    const { pixels, surface } = createRaster();
    surface.fillStyle = "#00ff00";
    surface.fillRect(-5, -5, 7, 7);
    surface.fillRect(sceneWidth - 1, sceneHeight - 1, 50, 50);
    surface.fillRect(10.4, 10.4, 1.2, 1.2);
    surface.fillRect(sceneWidth - 1, 0, 50, 1);
    surface.fillRect(-5, 5, 7, 1);
    expect(at(pixels, 1, 1)[3]).toBe(255);
    expect(at(pixels, 2, 2)[3]).toBe(0);
    expect(at(pixels, sceneWidth - 1, sceneHeight - 1)[3]).toBe(255);
    expect(at(pixels, 10, 10)[3]).toBe(255);
    // Past the right edge is cut off, not carried round to the start of the next row.
    expect(at(pixels, sceneWidth - 1, 0)[3]).toBe(255);
    expect(at(pixels, 30, 1)[3]).toBe(0);
    // Likewise past the left edge: not carried back to the end of the row above.
    expect(at(pixels, 1, 5)[3]).toBe(255);
    expect(at(pixels, sceneWidth - 2, 4)[3]).toBe(0);
    expect(pixels).toHaveLength(sceneWidth * sceneHeight * 4);
  });

  it("is emptied by clear, and refuses a gradient rather than drawing a guess", () => {
    const { clear, pixels, surface } = createRaster();
    surface.fillStyle = "#ffffff";
    surface.fillRect(0, 0, sceneWidth, sceneHeight);
    clear();
    expect(pixels.every((byte) => byte === 0)).toBe(true);
    surface.fillStyle = {} as CanvasGradient;
    expect(() => surface.fillRect(0, 0, 1, 1)).toThrow("plain colours");
  });
});

describe("the frames of a loop", () => {
  it("are a whole number spread evenly over the loop, ending one step before it starts again", () => {
    const plan = framePlan(2);
    expect(plan).toHaveLength(2 * videoSpec.fps);
    expect(plan[0]).toBe(0);
    expect(plan[1]).toBeCloseTo(2 / plan.length);
    expect(plan.at(-1)).toBeCloseTo(2 - 2 / plan.length);
  });

  it("round a loop that is not a whole number of frames, and never come to none", () => {
    expect(framePlan(1.01)).toHaveLength(30);
    expect(framePlan(0.001)).toEqual([0]);
  });
});

describe("a scene's files", () => {
  it("are named by the scene's id", () => {
    expect(videoFiles("runner")).toEqual({
      mp4: "runner.mp4",
      poster: "runner.png",
      webm: "runner.webm",
    });
  });
});

describe("every scene", () => {
  it.each(scenes.map((scene) => [scene.id, scene] as const))(
    "%s can be rendered, frame after frame, with something on every pixel",
    (_, scene) => {
      const frame = scene.make();
      const { clear, pixels, surface } = createRaster();
      for (const seconds of framePlan(frame.loopSeconds)) {
        clear();
        frame.draw(surface, seconds);
        for (let at = 3; at < pixels.length; at += 4)
          if (pixels[at] === 0) throw new Error(`A hole at ${seconds}s.`);
      }
    },
  );
});
