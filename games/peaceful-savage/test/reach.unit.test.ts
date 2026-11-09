import { Object3D, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { reach } from "../src/view/body/reach.ts";

// An arm: a shoulder turned a quarter round inside a body, an upper arm 0.3 long and a forearm 0.28 long, hanging.
function arm() {
  const body = new Object3D();
  body.rotation.y = Math.PI / 2;
  body.position.set(1, 1.4, 0);
  const shoulder = new Object3D();
  body.add(shoulder);
  const elbow = new Object3D();
  elbow.position.set(0, -0.3, 0);
  shoulder.add(elbow);
  const wrist = new Object3D();
  wrist.position.set(0, -0.28, 0);
  elbow.add(wrist);
  body.updateMatrixWorld(true);
  return { body, elbow, shoulder, wrist };
}

const at = (joint: Object3D): Vector3 => joint.getWorldPosition(new Vector3());

describe("a hand reaching for an exact place", () => {
  it("brings the wrist to a point in reach, the elbow bending the way it is asked", () => {
    const { elbow, shoulder, wrist } = arm();
    const target = new Vector3(1.25, 1.1, 0.2);
    reach(shoulder, elbow, wrist, target, new Vector3(0, -1, 0.6));
    expect(at(wrist).distanceTo(target)).toBeLessThan(1e-3);
    // The bones keep their lengths; the elbow goes down and back, toward the pole.
    expect(at(elbow).distanceTo(at(shoulder))).toBeCloseTo(0.3);
    expect(at(elbow).distanceTo(at(wrist))).toBeCloseTo(0.28);
    const middle = at(shoulder).lerp(target, 0.5);
    const toElbow = at(elbow).sub(middle);
    expect(toElbow.dot(new Vector3(0, -1, 0.6))).toBeGreaterThan(0);
    // A hinge: the elbow bends only about its own x.
    expect(elbow.rotation.y).toBe(0);
    expect(elbow.rotation.z).toBe(0);
    expect(elbow.rotation.x).toBeLessThan(0);
  });

  it("reaches as far as it can for a point beyond the arm, straight toward it", () => {
    const { elbow, shoulder, wrist } = arm();
    const target = new Vector3(3, 1.4, 0);
    reach(shoulder, elbow, wrist, target, new Vector3(0, -1, 0));
    const toward = target.clone().sub(at(shoulder)).normalize();
    const along = at(wrist).sub(at(shoulder));
    expect(along.length()).toBeCloseTo(0.58, 2);
    expect(along.normalize().dot(toward)).toBeGreaterThan(0.999);
  });

  it("still finds a way to bend when the pole lies along the arm, or the point is at the shoulder", () => {
    const { elbow, shoulder, wrist } = arm();
    const target = new Vector3(1, 1.0, 0);
    reach(shoulder, elbow, wrist, target, new Vector3(0, -1, 0));
    expect(at(wrist).distanceTo(target)).toBeLessThan(1e-3);
    reach(shoulder, elbow, wrist, at(shoulder), new Vector3(0, 0, 1));
    expect(Number.isFinite(at(wrist).x)).toBe(true);
    expect(at(wrist).distanceTo(at(shoulder))).toBeCloseTo(0.02, 2);
  });
});
