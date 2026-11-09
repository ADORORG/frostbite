import {
  AdditiveBlending,
  Group,
  Mesh,
  PointLight,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from "three";

import { glowing, softGlow } from "../palette.ts";

// Sparky: the ancestors' whisper made visible, a smiling golden atom with three rings (the shape of the atom Daddy built at eleven). He
// is forged ring by ring at the lamp that would not go out, then flies with the lead, a living compass that leans toward where the story
// goes next.
export interface Sparky {
  readonly group: Group;
  // How many rings are lit (0 to 3; Sparky's face shows at 3), where he should be, and how bright the lead's spark is.
  update(
    rings: number,
    at: Vector3,
    brightness: number,
    time: number,
    dt: number,
  ): void;
}

// Sparky is small: a third of the size he was first drawn at, a little light that rides at the lead's shoulder.
export const sparkySize = 1 / 3;

export function buildSparky(lights: boolean): Sparky {
  const group = new Group();
  group.scale.setScalar(sparkySize);
  const core = new Mesh(
    new SphereGeometry(0.11, 20, 14),
    glowing("#ffd25a", 1.05),
  );
  group.add(core);
  const face = new Group();
  for (const s of [1, -1]) {
    const eye = new Mesh(
      new SphereGeometry(0.016, 8, 6),
      glowing("#3a2008", 0),
    );
    eye.position.set(s * 0.035, 0.025, 0.1);
    face.add(eye);
  }
  const smile = new Mesh(
    new TorusGeometry(0.04, 0.009, 6, 16, Math.PI),
    glowing("#3a2008", 0),
  );
  smile.position.set(0, -0.01, 0.1);
  smile.rotation.z = Math.PI;
  face.add(smile);
  core.add(face);
  const rings = [0, 1, 2].map((index) => {
    const ring = new Mesh(
      new TorusGeometry(0.26, 0.012, 8, 48),
      glowing("#ffc84a", 1.6),
    );
    ring.rotation.set(index * 1.05, index * 0.6, 0);
    const electron = new Mesh(
      new SphereGeometry(0.025, 8, 6),
      glowing("#fff2c0", 2.2),
    );
    electron.position.x = 0.26;
    ring.add(electron);
    group.add(ring);
    return ring;
  });
  const halo = new Sprite(
    new SpriteMaterial({
      blending: AdditiveBlending,
      color: "#ffc84a",
      depthWrite: false,
      map: softGlow(),
      opacity: 0.6,
      transparent: true,
    }),
  );
  halo.scale.setScalar(0.5);
  group.add(halo);
  // His light reaches a third as far, too (a light's reach does not shrink with its group).
  const light = lights
    ? new PointLight("#ffcf6a", 0.8, 3.5 * sparkySize, 1.8)
    : null;
  if (light !== null) group.add(light);
  const velocity = new Vector3();
  return {
    group,
    update(lit, at, brightness, time, dt) {
      group.visible = lit > 0;
      rings.forEach((ring, index) => {
        ring.visible = index < lit;
        ring.rotation.z += dt * (1.4 + index * 0.5);
      });
      face.visible = lit >= 3;
      const wanted = at
        .clone()
        .add(
          new Vector3(
            Math.sin(time * 1.3) * 0.15 * sparkySize,
            Math.sin(time * 2.1) * 0.1 * sparkySize,
            0,
          ),
        );
      velocity.lerp(
        wanted.sub(group.position).multiplyScalar(4),
        1 - Math.exp(-6 * dt),
      );
      group.position.addScaledVector(velocity, dt);
      halo.material.opacity = 0.06 + brightness * 0.12;
      if (light !== null) light.intensity = 0.4 + brightness * 0.9;
    },
  };
}
