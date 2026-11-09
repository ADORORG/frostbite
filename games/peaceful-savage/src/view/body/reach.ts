import { Matrix4, type Object3D, Quaternion, Vector3 } from "three";

// A two-bone reach: turns the shoulder and bends the elbow so that the wrist comes to a point in the world, the elbow bending toward
// `pole` (a direction in the world: down and back, say, for a hand laid on a shoulder from behind). Used after the pose, where a hand
// must land on something exact. A point out of reach is reached for as far as the arm goes.
export function reach(
  shoulder: Object3D,
  elbow: Object3D,
  wrist: Object3D,
  target: Vector3,
  pole: Vector3,
): void {
  const from = shoulder.getWorldPosition(new Vector3());
  const bendAt = elbow.getWorldPosition(new Vector3());
  const upper = from.distanceTo(bendAt);
  const lower = bendAt.distanceTo(wrist.getWorldPosition(new Vector3()));
  const toward = target.clone().sub(from);
  const distance = Math.min(
    Math.max(toward.length(), Math.abs(upper - lower) + 1e-3),
    upper + lower - 1e-3,
  );
  const along = toward.lengthSq() > 1e-10 ? toward.normalize() : down.clone();
  // The way the elbow goes: the pole, square to the line from the shoulder to the hand.
  const aside = pole.clone().addScaledVector(along, -pole.dot(along));
  if (aside.lengthSq() < 1e-8)
    aside.copy(back).addScaledVector(along, -back.dot(along));
  aside.normalize();
  const cosine = (a: number, b: number, c: number) =>
    Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b))));
  const atShoulder = cosine(upper, distance, lower);
  const flexion = Math.PI - cosine(upper, lower, distance);
  const arm = along
    .clone()
    .multiplyScalar(Math.cos(atShoulder))
    .addScaledVector(aside, Math.sin(atShoulder));
  // The shoulder's frame: -y down the upper arm, +z the way the forearm bends (the elbow is a hinge across x).
  const fore = from
    .clone()
    .addScaledVector(along, distance)
    .sub(from.clone().addScaledVector(arm, upper));
  const bend = fore.addScaledVector(arm, -fore.dot(arm)).normalize();
  const y = arm.clone().negate();
  const x = new Vector3().crossVectors(y, bend);
  const turn = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(x, y, bend),
  );
  const parent =
    shoulder.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
  shoulder.quaternion.copy(parent.invert().multiply(turn));
  elbow.rotation.set(-flexion, 0, 0);
  shoulder.updateWorldMatrix(false, true);
}

const down = new Vector3(0, -1, 0);
const back = new Vector3(0, 0, 1);
