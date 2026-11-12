// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachPlacement,
  drawnIn,
  placementOf,
} from "../src/screen/phone-layout.ts";

// A box exactly twice the screen (144 by 184), so one unit of the screen is two pixels and the figures are plain.
const twice = { height: 368, left: 0, top: 0, width: 288 };
const origin = { left: 0, top: 0 };

describe("where the picture lies in its box", () => {
  it("fills a box of its own shape, and is as large as fits in any other, in the middle", () => {
    expect(drawnIn({ height: 368, width: 288 })).toEqual({
      left: 0,
      scale: 2,
      top: 0,
    });
    // Wider than the picture: the height decides, and the sides are left over.
    expect(drawnIn({ height: 368, width: 400 })).toEqual({
      left: 56,
      scale: 2,
      top: 0,
    });
    // Taller than the picture: the width decides, and the top and bottom are left over.
    expect(drawnIn({ height: 500, width: 288 })).toEqual({
      left: 0,
      scale: 2,
      top: 66,
    });
  });
});

describe("what the readouts and the buttons are placed by", () => {
  it("puts the left column where the held piece is, and the right where the pieces to come are", () => {
    const set = placementOf(twice, origin);
    expect(set["--pf-scale"]).toBe("2px");
    expect(set["--pf-hold-x"]).toBe("4px");
    expect(set["--pf-next-x"]).toBe("228px");
    expect(set["--pf-side-w"]).toBe("56px");
  });

  it("starts the free part of each column below its boxes: under the one held, and under the most pieces ever shown to come", () => {
    const set = placementOf(twice, origin);
    expect(set["--pf-below-hold"]).toBe("80px");
    expect(set["--pf-below-next"]).toBe("208px");
  });

  it("counts from the page, not from the window, and follows the box when it is not at the corner", () => {
    const set = placementOf(
      { ...twice, left: 10, top: 30 },
      { left: 4, top: 20 },
    );
    expect(set["--pf-hold-x"]).toBe("10px");
    expect(set["--pf-below-hold"]).toBe("90px");
  });

  it("keeps the columns on the picture when the box is wider than it", () => {
    const set = placementOf(
      { height: 368, left: 0, top: 0, width: 400 },
      origin,
    );
    expect(set["--pf-hold-x"]).toBe("60px");
    expect(set["--pf-next-x"]).toBe("284px");
  });
});

describe("keeping the page's properties right", () => {
  const stops: (() => void)[] = [];
  let callback: () => void = () => undefined;
  let disconnected = false;
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    vi.unstubAllGlobals();
    disconnected = false;
  });
  const setup = () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(on: () => void) {
          callback = on;
        }
        observe = () => undefined;
        disconnect = () => {
          disconnected = true;
        };
      },
    );
    const page = document.createElement("main");
    const screen = document.createElement("canvas");
    let box = { ...twice, bottom: 368, right: 288, x: 0, y: 0 };
    screen.getBoundingClientRect = () => ({ ...box, toJSON: () => ({}) });
    page.getBoundingClientRect = () => ({
      ...box,
      height: 0,
      left: 0,
      top: 0,
      toJSON: () => ({}),
      width: 0,
    });
    document.body.append(page, screen);
    stops.push(attachPlacement(page, screen));
    return {
      page,
      resize: (width: number, height: number) => {
        box = { ...box, bottom: height, height, right: width, width };
      },
    };
  };

  it("sets them at once, and again whenever the box changes or the window is resized", () => {
    const { page, resize } = setup();
    expect(page.style.getPropertyValue("--pf-scale")).toBe("2px");
    resize(144, 184);
    callback();
    expect(page.style.getPropertyValue("--pf-scale")).toBe("1px");
    resize(432, 552);
    window.dispatchEvent(new Event("resize"));
    expect(page.style.getPropertyValue("--pf-scale")).toBe("3px");
  });

  it("stops watching when it is told to", () => {
    const { page, resize } = setup();
    for (const stop of stops.splice(0)) stop();
    expect(disconnected).toBe(true);
    resize(144, 184);
    window.dispatchEvent(new Event("resize"));
    expect(page.style.getPropertyValue("--pf-scale")).toBe("2px");
  });
});
