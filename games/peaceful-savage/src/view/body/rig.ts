import { Bone, Object3D, Skeleton } from "three";

// A body's skeleton, built joint by joint in code: pelvis, three joints of spine, neck, head and jaw; clavicle, shoulder, elbow, forearm
// twist and wrist on each arm; thumb and four fingers of three joints each; hip, knee, ankle and toes on each leg. A pose names how far
// each joint turns, in the body's own words ("the left elbow bends 1.2"), and every value is held to the range a person's joint has, so
// no pose breaks a body. The body faces +z; its left is +x.
export interface Build {
  readonly foot: number;
  readonly forearm: number;
  readonly hand: number;
  readonly head: number;
  readonly hip: number;
  readonly limb: number;
  readonly neck: number;
  readonly shin: number;
  readonly shoulder: number;
  readonly thigh: number;
  readonly torso: number;
  readonly upperArm: number;
}

export const sides = ["L", "R"] as const;
export type Side = (typeof sides)[number];
export const fingerNames = [
  "thumb",
  "index",
  "middle",
  "ring",
  "pinky",
] as const;
export type Finger = (typeof fingerNames)[number];

// Every value a pose can set, with the range it is held to (radians, or metres for the hips' drop and sway).
const shared = {
  "chest.bend": [-0.4, 0.6],
  "head.nod": [-0.6, 0.6],
  "head.tilt": [-0.5, 0.5],
  "head.turn": [-1.2, 1.2],
  "hips.drop": [-0.6, 0.15],
  "hips.roll": [-0.3, 0.3],
  "hips.sway": [-0.2, 0.2],
  "hips.turn": [-0.8, 0.8],
  jaw: [0, 0.45],
  "neck.bend": [-0.5, 0.6],
  "spine.bend": [-0.5, 0.95],
  "spine.side": [-0.4, 0.4],
  "spine.twist": [-0.7, 0.7],
} as const;
const perSide = {
  ankle: [-0.8, 0.9],
  "arm.front": [-1.0, 3.0],
  "arm.side": [-0.3, 2.9],
  "arm.twist": [-1.4, 1.4],
  clavicle: [-0.2, 0.5],
  elbow: [0, 2.5],
  "fore.twist": [-1.5, 1.5],
  index: [-0.2, 1.6],
  knee: [0, 2.5],
  "leg.front": [-0.6, 2.3],
  "leg.side": [-0.4, 1.0],
  middle: [-0.2, 1.6],
  pinky: [-0.2, 1.6],
  ring: [-0.2, 1.6],
  spread: [-0.2, 0.5],
  thumb: [-0.3, 1.3],
  toes: [-0.6, 0.6],
  "wrist.bend": [-1.2, 1.2],
  "wrist.side": [-0.5, 0.5],
} as const;

type SharedChannel = keyof typeof shared;
type SidedName = keyof typeof perSide;
export type Channel = SharedChannel | `${SidedName}${Side}`;
export type Pose = Partial<Record<Channel, number>>;

export const limits: Readonly<Record<string, readonly [number, number]>> = {
  ...shared,
  ...Object.fromEntries(
    sides.flatMap((side) =>
      Object.entries(perSide).map(
        ([name, range]) => [`${name}${side}`, range] as const,
      ),
    ),
  ),
};

export const clampTo = (channel: string, value: number): number => {
  const range = limits[channel];
  return range === undefined
    ? value
    : Math.min(range[1], Math.max(range[0], value));
};

export interface Rig {
  readonly build: Build;
  readonly joints: ReadonlyMap<string, Object3D>;
  readonly root: Object3D;
  joint(name: string): Object3D;
  // Where a joint is in the bones of the skeleton (for skinning).
  boneIndex(name: string): number;
  // The height of the hips above the feet at rest.
  readonly legLength: number;
  readonly skeleton: Skeleton;
}

function joint(
  name: string,
  parent: Object3D,
  x: number,
  y: number,
  z: number,
): Bone {
  const made = new Bone();
  made.name = name;
  made.position.set(x, y, z);
  parent.add(made);
  return made;
}

export function buildRig(build: Build): Rig {
  const joints = new Map<string, Bone>();
  const add = (
    name: string,
    parent: Object3D,
    x: number,
    y: number,
    z: number,
  ) => {
    const made = joint(name, parent, x, y, z);
    joints.set(name, made);
    return made;
  };
  const root = new Object3D();
  root.name = "root";
  const legLength = build.thigh + build.shin + build.foot * 0.35;
  const pelvis = add("pelvis", root, 0, legLength, 0);
  const spine = add("spine", pelvis, 0, build.torso * 0.18, 0);
  const spine2 = add("spine2", spine, 0, build.torso * 0.28, 0);
  const chest = add("chest", spine2, 0, build.torso * 0.28, 0);
  const neck = add("neck", chest, 0, build.torso * 0.26, 0);
  const head = add("head", neck, 0, build.neck, 0);
  add("jaw", head, 0, build.head * 0.15, build.head * 0.25);
  for (const side of sides) {
    const s = side === "L" ? 1 : -1;
    const clavicle = add(
      `clavicle${side}`,
      chest,
      s * build.shoulder * 0.25,
      build.torso * 0.2,
      0,
    );
    const shoulder = add(
      `shoulder${side}`,
      clavicle,
      s * build.shoulder * 0.75,
      0,
      0,
    );
    const elbow = add(`elbow${side}`, shoulder, 0, -build.upperArm, 0);
    const fore = add(`fore${side}`, elbow, 0, -build.forearm * 0.5, 0);
    const wrist = add(`wrist${side}`, fore, 0, -build.forearm * 0.5, 0);
    // The hand's own frame: fingers point down its -y, the palm faces its +z, the knuckles run along its x (the thumb on the outer side).
    // The forearm turns it so that at rest the palm faces the leg.
    const across = [0.42, 0.27, 0.09, -0.09, -0.25];
    fingerNames.forEach((finger, index) => {
      const thumb = finger === "thumb";
      let base = add(
        `${finger}${side}1`,
        wrist,
        s * build.hand * (across[index] ?? 0) * 0.9,
        -build.hand * (thumb ? 0.22 : 0.55),
        build.hand * (thumb ? 0.16 : 0),
      );
      const length =
        build.hand *
        (finger === "middle" ? 0.17 : finger === "pinky" ? 0.12 : 0.15);
      for (const part of [2, 3])
        base = add(`${finger}${side}${String(part)}`, base, 0, -length, 0);
    });
    const hip = add(
      `hip${side}`,
      pelvis,
      s * build.hip * 0.62,
      -build.hip * 0.1,
      0,
    );
    const knee = add(`knee${side}`, hip, 0, -build.thigh, 0);
    const ankle = add(`ankle${side}`, knee, 0, -build.shin, 0);
    add(`toes${side}`, ankle, 0, -build.foot * 0.3, build.foot * 0.62);
  }
  const bones = [...joints.values()];
  const skeleton = new Skeleton(bones);
  return {
    boneIndex(name) {
      const found = joints.get(name);
      return found === undefined ? 0 : bones.indexOf(found);
    },
    build,
    joint(name) {
      const found = joints.get(name);
      if (found === undefined) throw new Error(`No joint ${name}`);
      return found;
    },
    joints,
    legLength,
    root,
    skeleton,
  };
}

const at = (pose: Pose, channel: string): number => {
  const record: Readonly<Record<string, number | undefined>> = pose;
  return clampTo(channel, record[channel] ?? 0);
};

// Sets every joint from a pose. Values not named are the rest pose (arms a little out from the body, legs straight).
export function applyPose(rig: Rig, pose: Pose): void {
  const j = (name: string) => rig.joint(name);
  const value = (channel: string) => at(pose, channel);
  j("pelvis").position.set(
    value("hips.sway"),
    rig.legLength + value("hips.drop"),
    0,
  );
  j("pelvis").rotation.set(0, value("hips.turn"), value("hips.roll"));
  j("spine").rotation.set(
    value("spine.bend") * 0.4,
    value("spine.twist") * 0.5,
    value("spine.side") * 0.5,
  );
  j("spine2").rotation.set(
    value("spine.bend") * 0.35,
    value("spine.twist") * 0.5,
    value("spine.side") * 0.5,
  );
  j("chest").rotation.set(
    value("chest.bend") + value("spine.bend") * 0.25,
    0,
    0,
  );
  j("neck").rotation.set(value("neck.bend"), value("head.turn") * 0.35, 0);
  j("head").rotation.set(
    value("head.nod"),
    value("head.turn") * 0.65,
    value("head.tilt"),
  );
  j("jaw").rotation.set(value("jaw"), 0, 0);
  for (const side of sides) {
    const s = side === "L" ? 1 : -1;
    const v = (name: string) => value(`${name}${side}`);
    j(`clavicle${side}`).rotation.set(0, 0, s * v("clavicle"));
    j(`shoulder${side}`).rotation.set(
      -v("arm.front"),
      s * v("arm.twist"),
      s * (0.12 + v("arm.side")),
      "ZXY",
    );
    j(`elbow${side}`).rotation.set(-v("elbow"), 0, 0);
    j(`fore${side}`).rotation.set(0, s * (v("fore.twist") - Math.PI / 2), 0);
    j(`wrist${side}`).rotation.set(-v("wrist.bend"), 0, s * v("wrist.side"));
    fingerNames.forEach((finger, index) => {
      const curl = v(finger);
      const fan = (index - 2) * v("spread") * 0.3 * s;
      const thumb = finger === "thumb";
      j(`${finger}${side}1`).rotation.set(
        thumb ? -curl * 0.5 : -curl * 0.8,
        0,
        thumb ? s * (0.5 - curl * 0.9) : fan,
      );
      j(`${finger}${side}2`).rotation.set(-curl, 0, 0);
      j(`${finger}${side}3`).rotation.set(-curl * 0.8, 0, 0);
    });
    j(`hip${side}`).rotation.set(-v("leg.front"), 0, s * v("leg.side"));
    j(`knee${side}`).rotation.set(v("knee"), 0, 0);
    j(`ankle${side}`).rotation.set(-v("ankle"), 0, 0);
    j(`toes${side}`).rotation.set(v("toes"), 0, 0);
  }
}
