import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import type { Box } from "../src/rules/geometry.ts";
import { createCameraRig, type Intent } from "../src/view/camera.ts";
import type { Placed } from "../src/view/family.ts";
import { farewellShot } from "../src/view/farewell.ts";

// The lead stands at the middle facing +z, 1.4 tall, hands at the chest.
const lead: Placed = {
  at: new Vector3(0, 0, 0),
  height: 1.4,
  hero: "kai",
  yaw: 0,
};
const hands = new Vector3(0, 0.85, 0.25);

// Where the camera settles for a shot, after a few seconds of easing.
function settle(
  intent: Intent,
  walls: readonly Box[] = [],
  extra: Partial<{
    framing: ReturnType<typeof farewellShot>;
    ground: (x: number, z: number) => number;
    group: readonly Placed[];
  }> = {},
): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.05, 200);
  const rig = createCameraRig();
  for (let frame = 0; frame < 300; frame += 1)
    rig.update({
      camera,
      dt: 1 / 30,
      focus: null,
      framing: extra.framing ?? null,
      ...(extra.ground === undefined ? {} : { ground: extra.ground }),
      group: extra.group ?? [],
      hands,
      intent,
      lead,
      walls,
    });
  return camera;
}

const ahead = (camera: PerspectiveCamera): number =>
  camera.position.clone().sub(lead.at).setY(0).normalize().z;

describe("the camera's close and wide shots", () => {
  it("comes in close on the hands for a hand-key, from the front and a little to the side", () => {
    const close = settle("hands");
    const follow = settle("follow");
    const away = close.position.distanceTo(hands);
    expect(away).toBeLessThan(1.2);
    expect(away).toBeLessThan(follow.position.distanceTo(hands));
    expect(ahead(close)).toBeGreaterThan(0.4);
    expect(Math.abs(close.position.x)).toBeGreaterThan(0.2);
    expect(close.fov).toBeLessThan(follow.fov);
    // Looking at the hands: they sit near the middle of the picture.
    const seen = hands.clone().project(close);
    expect(Math.abs(seen.x)).toBeLessThan(0.3);
    expect(Math.abs(seen.y)).toBeLessThan(0.4);
  });

  it("frames the chest and face for the breath, and stands back to see a dance", () => {
    const breath = settle("breath");
    const dance = settle("dance");
    expect(ahead(breath)).toBeGreaterThan(0.4);
    const face = new Vector3(0, 1.25, 0);
    expect(breath.position.distanceTo(face)).toBeLessThan(2.2);
    expect(dance.position.distanceTo(lead.at)).toBeGreaterThan(
      breath.position.distanceTo(lead.at),
    );
    // The whole body is in the dance's picture.
    for (const point of [new Vector3(0, 0.05, 0), new Vector3(0, 1.4, 0)]) {
      const seen = point.project(dance);
      expect(Math.abs(seen.y)).toBeLessThan(1);
    }
  });

  it("looks round the lead for a close shot with no wall in the way", () => {
    // A wall just in front and to the right of the lead, where the close shot would stand.
    const wall: Box = { x0: -2_000, x1: -450, z0: 450, z1: 2_000 };
    const close = settle("hands", [wall]);
    const inside =
      close.position.x * 1000 >= wall.x0 &&
      close.position.x * 1000 <= wall.x1 &&
      close.position.z * 1000 >= wall.z0 &&
      close.position.z * 1000 <= wall.z1;
    expect(inside).toBe(false);
    // Not squashed in against the lead by the wall: it found another way round, at its own distance.
    expect(close.position.clone().setY(0).length()).toBeGreaterThan(0.7);
    expect(close.position.distanceTo(hands)).toBeLessThan(1.4);
  });

  it("rises and pulls back for each of the family walking with the lead, so they never stand in the way", () => {
    const beside = (x: number, z: number): Placed => ({
      at: new Vector3(x, 0, z),
      height: 1.6,
      hero: "ali",
      yaw: 0,
    });
    const alone = settle("follow");
    const one = settle("follow", [], { group: [beside(0.7, -0.25)] });
    const three = settle("follow", [], {
      group: [beside(0.7, -0.25), beside(-0.7, -0.25), beside(-1.35, -0.7)],
    });
    // One far off does not count.
    const far = settle("follow", [], { group: [beside(9, 9)] });
    expect(far.position.distanceTo(alone.position)).toBeLessThan(0.01);
    expect(one.position.y).toBeGreaterThan(alone.position.y);
    expect(three.position.y).toBeGreaterThan(one.position.y + 0.5);
    expect(three.position.distanceTo(lead.at)).toBeGreaterThan(
      alone.position.distanceTo(lead.at) + 1.2,
    );
    // From there the lead's head is in sight over everyone's.
    const head = new Vector3(0, 1.3, 0);
    const toHead = head.clone().sub(three.position);
    for (const one of [beside(0.7, -0.25), beside(-0.7, -0.25)]) {
      const top = one.at.clone().setY(one.height);
      const along = top
        .clone()
        .sub(three.position)
        .dot(toHead.clone().normalize());
      const off = top
        .clone()
        .sub(three.position)
        .sub(toHead.clone().normalize().multiplyScalar(along))
        .length();
      expect(off).toBeGreaterThan(0.3);
    }
  });

  it("never goes under the hill: over the ground where it stands, and with its line to the lead clear of it", () => {
    // The lead faces +z; the ground rises steeply behind them, where the camera follows from.
    const hill = (_x: number, z: number) => Math.max(0, -z * 1.2);
    const camera = settle("follow", [], { ground: hill });
    expect(camera.position.y).toBeGreaterThanOrEqual(
      hill(camera.position.x, camera.position.z) + 0.5 - 1e-6,
    );
    const head = new Vector3(0, 1.3, 0);
    for (const along of [0.25, 0.5, 0.75]) {
      const on = camera.position.clone().lerp(head, along);
      expect(on.y).toBeGreaterThan(hill(on.x, on.z));
    }
    // On flat ground nothing changes.
    expect(
      settle("follow", [], { ground: () => 0 }).position.distanceTo(
        settle("follow").position,
      ),
    ).toBeLessThan(1e-6);
  });

  it("takes the farewell's own shot", () => {
    const framing = farewellShot(6, new Vector3());
    const camera = settle("farewell", [], { framing });
    expect(camera.position.z).toBeCloseTo(-framing.distance, 1);
    expect(camera.position.y).toBeCloseTo(framing.height, 1);
    expect(camera.fov).toBeCloseTo(framing.fov, 1);
  });
});
