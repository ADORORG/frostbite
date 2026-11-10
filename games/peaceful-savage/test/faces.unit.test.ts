// @vitest-environment jsdom
import {
  CanvasTexture,
  MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { heroIds } from "../src/rules/constants.ts";
import { expressions } from "../src/view/body/head.ts";
import { headOf } from "../src/view/body/head-shape.ts";
import { looks } from "../src/view/body/looks.ts";
import { buildPortrait } from "../src/view/body/portrait.ts";
import { paint, painted } from "../src/view/palette.ts";
import { inkMaterial, toon } from "../src/view/toon.ts";
import { flowerPaint } from "../src/view/world/flowers.ts";
import { buildMeadow } from "../src/view/world/meadow.ts";

// jsdom cannot draw, so a 2D context here is a stand-in that takes every call and counts them.
function fakeContext() {
  const calls = { count: 0 };
  const gradient = { addColorStop: () => undefined };
  const context = new Proxy(
    {},
    {
      get(_, name) {
        if (name === "calls") return calls;
        if (name === "createRadialGradient" || name === "createLinearGradient")
          return () => gradient;
        return () => {
          calls.count += 1;
        };
      },
      set: () => true,
    },
  );
  return { calls, context };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the painted faces", () => {
  it("paints each of the family's faces in every expression, and paints a face again only when it changes", () => {
    const { calls, context } = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => context as unknown as CanvasRenderingContext2D,
    );
    for (const [index, hero] of heroIds.entries()) {
      const look = looks[hero];
      const portrait = buildPortrait(
        look,
        headOf(look.face).layout,
        look.face.young,
        index + 1,
      );
      expect(portrait.texture).toBeInstanceOf(CanvasTexture);
      for (const expression of expressions) {
        const before = calls.count;
        portrait.paint(expression, 0.2);
        expect(calls.count).toBeGreaterThan(before);
        const painted = calls.count;
        portrait.paint(expression, 0.2);
        expect(calls.count).toBe(painted);
      }
    }
  });

  it("keeps a plain face where there is no canvas to paint on", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => null,
    );
    const portrait = buildPortrait(
      looks.kai,
      headOf(looks.kai.face).layout,
      1,
      3,
    );
    expect(portrait.texture).not.toBeInstanceOf(CanvasTexture);
    portrait.paint("smile", 0);
  });
});

// What the GPU would hand a material's shader hook: the source it is about to compile, to be added to.
const shaderOf = (): WebGLProgramParametersWithUniforms =>
  ({
    fragmentShader:
      "#include <common>\nvoid main() {\n#include <emissivemap_fragment>\n#include <dithering_fragment>\n}",
    uniforms: {},
    vertexShader:
      "#include <common>\nvoid main() {\n#include <begin_vertex>\n}",
  }) as unknown as WebGLProgramParametersWithUniforms;
const renderer = {} as WebGLRenderer;

describe("the storybook shaders", () => {
  it("greys a room's paint in moonlight and lets its colour back by the room's share", () => {
    const tone = { value: 0.25 };
    const shader = shaderOf();
    paint(new MeshStandardMaterial(), tone).onBeforeCompile(shader, renderer);
    expect(shader.uniforms.savageColour).toBe(tone);
    expect(shader.fragmentShader).toContain("savageGrey");
    const toonShader = shaderOf();
    const material = toon(tone, { rim: 0.5 });
    material.onBeforeCompile(toonShader, renderer);
    expect(toonShader.fragmentShader).toContain("savageRim");
    expect(material.customProgramCacheKey()).toBe("savage-toon");
    const plain = painted(tone, { color: "#ffffff" });
    expect(plain.customProgramCacheKey()).toBe("savage-toon");
  });

  it("draws the ink line as the shape pushed out along its normals, and flowers that glow in their own colour", () => {
    const shader = shaderOf();
    const ink = inkMaterial(0.02);
    ink.onBeforeCompile(shader, renderer);
    expect(shader.vertexShader).toContain("normalize(normal) * inkWidth");
    expect(ink.customProgramCacheKey()).toBe("savage-ink-0.02");
    const flowerShader = shaderOf();
    const flowers = flowerPaint({ value: 1 });
    flowers.onBeforeCompile(flowerShader, renderer);
    expect(flowerShader.fragmentShader).toContain("diffuseColor.rgb * 0.35");
    expect(flowers.customProgramCacheKey()).toBe("savage-flower");
  });

  it("sways the meadow's grass in the wind, with a program of its own", () => {
    const meadow = buildMeadow({ value: 1 }, 0.2);
    meadow.update(3);
    const grass = meadow.group.children.find(
      (child) =>
        "material" in child &&
        child.material instanceof Object &&
        "customProgramCacheKey" in child.material &&
        typeof child.material.customProgramCacheKey === "function" &&
        child.material.customProgramCacheKey() === "savage-grass",
    );
    if (grass === undefined || !("material" in grass))
      throw new Error("no grass");
    const material = grass.material as MeshStandardMaterial;
    const shader = shaderOf();
    material.onBeforeCompile(shader, renderer);
    expect(shader.vertexShader).toContain("savageWind");
    expect(shader.uniforms.savageWind).toEqual({ value: 3 });
  });
});
