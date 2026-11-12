import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";

import { brushed, noise, softGlow } from "./palette.ts";

// The magic, drawn as the book draws it: glowing gold line-work, not sparks. A hand-key leaves a trail of gold line behind the hand; a
// healed grey, a found family member or a lit tree sends a ring of gold out over the floor; Savage Vision lays a thread of gold from the
// lead to where the story goes next. The office floor has its grey fog, and the meadow its fireflies.
export interface Effects {
  readonly group: Group;
  // A ring of gold spreading from a point.
  burst(at: Vector3, size: number): void;
  // Where each hand is (for its trail), whether trails are drawn now, the vision path (or null), and the time.
  update(
    hands: readonly Vector3[],
    tracing: boolean,
    path: readonly Vector3[] | null,
    fog: number,
    time: number,
    dt: number,
  ): void;
}

const trailLength = 48;

export function buildEffects(): Effects {
  const group = new Group();
  const trails = [0, 1].map(() => {
    const positions = new Float32Array(trailLength * 3);
    const geometry = new BufferGeometry().setAttribute(
      "position",
      new BufferAttribute(positions, 3),
    );
    const line = new Line(
      geometry,
      new LineBasicMaterial({
        blending: AdditiveBlending,
        color: "#ffd25a",
        opacity: 0.9,
        transparent: true,
      }),
    );
    line.frustumCulled = false;
    group.add(line);
    return { line, points: [] as Vector3[] };
  });
  const rings: {
    mesh: Mesh<TorusGeometry, MeshBasicMaterial>;
    age: number;
    size: number;
  }[] = [];
  let path: Mesh<TubeGeometry, MeshBasicMaterial> | null = null;
  let laid: readonly Vector3[] | null = null;
  // The grey fog over the office floor: a few drifting layers.
  const fogTexture = brushed("#8f93a0", 97, 1);
  const fogLayers = [0, 1, 2].map((index) => {
    const layer = new Mesh(
      new PlaneGeometry(8.6, 6.6),
      new MeshBasicMaterial({
        alphaMap: fogTexture,
        color: "#b4b8c4",
        depthWrite: false,
        opacity: 0.3,
        transparent: true,
      }),
    );
    layer.rotation.x = -Math.PI / 2;
    layer.position.set(7.5, 0.08 + index * 0.12, 3.5);
    group.add(layer);
    return layer;
  });
  // Fireflies drift over the meadow and the porch, each blinking in its own time.
  const random = noise(131);
  const flyCount = 220;
  const homes = Float32Array.from({ length: flyCount * 3 }, (_, at) =>
    at % 3 === 0
      ? (random() - 0.5) * 46
      : at % 3 === 1
        ? 0.5 + random() * 2.2
        : -1.5 - random() * 26,
  );
  const fireflies = new Points(
    new BufferGeometry()
      .setAttribute("position", new BufferAttribute(homes.slice(), 3))
      .setAttribute(
        "color",
        new BufferAttribute(new Float32Array(flyCount * 3), 3),
      ),
    new PointsMaterial({
      blending: AdditiveBlending,
      color: "#ffe28a",
      depthWrite: false,
      map: softGlow(),
      size: 0.32,
      transparent: true,
      vertexColors: true,
    }),
  );
  group.add(fireflies);
  return {
    burst(at, size) {
      const mesh = new Mesh(
        new TorusGeometry(1, 0.03, 6, 64),
        new MeshBasicMaterial({
          blending: AdditiveBlending,
          color: "#ffd25a",
          depthWrite: false,
          transparent: true,
        }),
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.copy(at).setY(at.y + 0.05);
      group.add(mesh);
      rings.push({ age: 0, mesh, size });
    },
    group,
    update(hands, tracing, vision, fog, time, dt) {
      trails.forEach((trail, index) => {
        const hand = hands[index];
        if (tracing && hand !== undefined) trail.points.push(hand.clone());
        else trail.points.shift();
        while (trail.points.length > trailLength) trail.points.shift();
        const position = trail.line.geometry.getAttribute("position");
        for (let at = 0; at < trailLength; at += 1) {
          const point =
            trail.points[Math.min(at, trail.points.length - 1)] ??
            new Vector3(0, -50, 0);
          position.setXYZ(at, point.x, point.y, point.z);
        }
        position.needsUpdate = true;
        trail.line.visible = trail.points.length > 1;
      });
      for (const ring of [...rings]) {
        ring.age += dt;
        const grown = 0.3 + ring.age * ring.size * 1.6;
        ring.mesh.scale.setScalar(grown);
        ring.mesh.material.opacity = Math.max(0, 1 - ring.age / 1.4);
        if (ring.age > 1.4) {
          group.remove(ring.mesh);
          ring.mesh.geometry.dispose();
          rings.splice(rings.indexOf(ring), 1);
        }
      }
      // The thread is laid again only when its way changes.
      if (vision !== laid && path !== null) {
        group.remove(path);
        path.geometry.dispose();
        path = null;
      }
      if (vision !== laid && vision !== null && vision.length > 1) {
        path = new Mesh(
          new TubeGeometry(
            new CatmullRomCurve3([...vision]),
            40,
            0.025,
            5,
            false,
          ),
          new MeshBasicMaterial({
            blending: AdditiveBlending,
            color: "#ffd25a",
            depthWrite: false,
            opacity: 0.55 + Math.sin(time * 4) * 0.2,
            transparent: true,
          }),
        );
        group.add(path);
      }
      laid = vision;
      if (path !== null)
        path.material.opacity = 0.55 + Math.sin(time * 4) * 0.2;
      fogLayers.forEach((layer, index) => {
        layer.material.opacity = fog * (0.28 - index * 0.06);
        layer.position.x = 7.5 + Math.sin(time * 0.2 + index) * 0.3;
        layer.rotation.z = time * 0.02 * (index + 1);
      });
      const fly = fireflies.geometry.getAttribute("position");
      const glow = fireflies.geometry.getAttribute("color");
      for (let at = 0; at < flyCount; at += 1) {
        fly.setXYZ(
          at,
          (homes[at * 3] ?? 0) + Math.sin(time * 0.31 + at * 1.7) * 0.6,
          (homes[at * 3 + 1] ?? 1) + Math.sin(time * 0.7 + at) * 0.35,
          (homes[at * 3 + 2] ?? -5) + Math.cos(time * 0.27 + at * 1.3) * 0.6,
        );
        const blink = Math.max(0, Math.sin(time * 1.3 + at * 2.1));
        glow.setXYZ(
          at,
          0.15 + blink * 0.85,
          0.15 + blink * 0.85,
          0.1 + blink * 0.6,
        );
      }
      fly.needsUpdate = true;
      glow.needsUpdate = true;
    },
  };
}
