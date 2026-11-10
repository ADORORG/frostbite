// @vitest-environment jsdom
import { Mesh, MeshStandardMaterial, Vector3, type Material } from "three";
import { beforeAll, describe, expect, it } from "vitest";

import { ArenaView } from "../src/screen/arena.ts";
import type { Models } from "../src/screen/models/load.ts";
import { createStage } from "../src/screen/stage.ts";
import { fakeStage, models } from "./support/view.ts";

let all: Models;
beforeAll(async () => {
  all = await models();
}, 60_000);

describe("the stage", () => {
  it("is not made where the browser has no WebGL 2", () => {
    expect(createStage(document.createElement("canvas"), false)).toBeNull();
  });

  it("starts a step down on a phone, takes the quality a page asks for, and steps down and back up by how long frames take", () => {
    expect(fakeStage(true).stage.quality().level).toBe(2);
    expect(fakeStage(false, "?quality=1").stage.quality().level).toBe(1);
    expect(fakeStage(false, "?quality=9").stage.quality().level).toBe(3);
    const { renderer, stage } = fakeStage();
    const seen: number[] = [];
    stage.onQuality((quality) => seen.push(quality.level));
    for (let frame = 0; frame < 400; frame += 1) stage.frameTook(80);
    expect(stage.quality().level).toBe(0);
    expect(renderer.shadowMap.enabled).toBe(false);
    for (let frame = 0; frame < 3000; frame += 1) stage.frameTook(4);
    expect(stage.quality().level).toBe(3);
    expect(seen[0]).toBe(3);
    expect(seen).toContain(0);
    const phone = fakeStage(true).stage;
    for (let frame = 0; frame < 3000; frame += 1) phone.frameTook(4);
    expect(phone.quality().level).toBe(2);
    stage.aim(new Vector3(2, 0, 3));
    expect(stage.moon.target.position.x).toBe(2);
    stage.render();
    expect(renderer.render).toHaveBeenCalledOnce();
  });
});

describe("the materials' shaders", () => {
  it("are each given the time and frost vision's depth as three.js compiles them", () => {
    const keys = new Set<string>();
    const materials = new Set<Material>();
    for (const name of [
      "arena-crown",
      "arena-sound",
      "crystal",
      "hero-volt",
      "hero-lumen",
      "key",
      "cage",
    ] as const)
      all(name).scene.traverse((part) => {
        if (!(part instanceof Mesh)) return;
        for (const material of [part.material].flat()) materials.add(material);
      });
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      const shader = {
        fragmentShader: "#include <common>\n#include <emissivemap_fragment>",
        uniforms: {},
        vertexShader:
          "#include <common>\n#include <begin_vertex>\n#include <project_vertex>",
      };
      material.onBeforeCompile(shader as never, null as never);
      const key = material.customProgramCacheKey();
      if (!key.startsWith("frost")) continue;
      keys.add(key);
      expect(shader.uniforms).toHaveProperty("uTime");
      expect(shader.vertexShader).toContain("vWorldPos");
      expect(shader.fragmentShader).toContain("uVision");
    }
    for (const key of [
      "frost-holo",
      "frost-spirit",
      "frost-crystal",
      "frost-gem",
    ])
      expect(keys).toContain(key);
  });
});

describe("the arenas", () => {
  it("fade a pillar that stands between the camera and the hero, and bring it back after", () => {
    const crown = new ArenaView(all("arena-crown"));
    crown.group.visible = true;
    crown.update(1 / 60, 1);
    const pillar = crown.group.getObjectByName("Pillar1");
    expect(pillar).toBeDefined();
    const at = new Vector3();
    pillar?.getWorldPosition(at);
    const opacity = () => {
      let seen = 1;
      pillar?.traverse((part) => {
        if (part instanceof Mesh)
          seen = [part.material].flat()[0]?.opacity ?? 1;
      });
      return seen;
    };
    for (let frame = 0; frame < 60; frame += 1)
      crown.clearView(
        1 / 60,
        new Vector3(at.x * 2, 8, at.z * 2),
        new Vector3(0, 0, 0),
      );
    expect(opacity()).toBeLessThan(0.5);
    for (let frame = 0; frame < 60; frame += 1)
      crown.clearView(
        1 / 60,
        new Vector3(-at.x * 2, 8, -at.z * 2),
        new Vector3(0, 0, 0),
      );
    expect(opacity()).toBeGreaterThan(0.9);
    crown.clearView(1 / 60, new Vector3(0, 8, 0), new Vector3(0, 0, 0));
  });
});
