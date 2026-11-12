import { describe, expect, it } from "vitest";

import {
  isSoftware,
  qualities,
  softwareQuality,
  startingQuality,
} from "../src/view/stage.ts";

const context = (renderer: string | null) => ({
  getExtension: () =>
    renderer === null ? null : { UNMASKED_RENDERER_WEBGL: 37_446 },
  getParameter: (name: number) => (name === 37_446 ? renderer : null),
});

describe("the picture's quality", () => {
  it("starts in the middle on a phone or a small machine, at the top otherwise", () => {
    expect(startingQuality(true, 8)).toBe(1);
    expect(startingQuality(false, 4)).toBe(1);
    expect(startingQuality(false, 8)).toBe(2);
  });

  it("knows a picture drawn in software, and draws it lightest of all", () => {
    expect(
      isSoftware(
        context(
          "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)",
        ),
      ),
    ).toBe(true);
    expect(isSoftware(context("llvmpipe (LLVM 15.0.7, 256 bits)"))).toBe(true);
    expect(
      isSoftware(context("ANGLE (Apple, ANGLE Metal Renderer: Apple M2)")),
    ).toBe(false);
    expect(isSoftware(context(null))).toBe(false);
    const silent = {
      getExtension: () => {
        throw new Error("no extensions here");
      },
      getParameter: () => null,
    };
    expect(isSoftware(silent)).toBe(false);
    const lightest = qualities[0];
    expect(softwareQuality.pixels).toBeLessThan(lightest?.pixels ?? 0);
    expect(softwareQuality.amount).toBeLessThan(lightest?.amount ?? 0);
    expect(softwareQuality).toMatchObject({
      bloom: false,
      lights: false,
      shadows: 0,
    });
  });
});
