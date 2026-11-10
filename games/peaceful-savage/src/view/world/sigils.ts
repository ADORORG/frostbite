import { Vector3 } from "three";

import type { HandKey } from "../../rules/constants.ts";

// The shapes of light the family draws: each hand-key's own, and the body's (a shield, a field of loops, a flower of circles, a star of
// two pyramids). Each is a list of strokes in the order they are drawn.
export type Sigil = HandKey | "field" | "flower" | "shield" | "star";

const tau = Math.PI * 2;
const circle = (
  centre: Vector3,
  radius: number,
  plane: "front" | "ground",
  from = 0,
  to = tau,
  steps = 48,
): Vector3[] =>
  Array.from({ length: steps + 1 }, (_, at) => {
    const angle = from + ((to - from) * at) / steps;
    const a = Math.cos(angle) * radius;
    const b = Math.sin(angle) * radius;
    return centre
      .clone()
      .add(plane === "front" ? new Vector3(a, b, 0) : new Vector3(a, 0, b));
  });
const origin = new Vector3();

// Each shape as strokes in the order they are drawn, a unit across (the hand-keys) or a unit tall (the body's shapes).
export function strokesOf(sigil: Sigil): Vector3[][] {
  switch (sigil) {
    case "cup":
      return [
        ...[1, 0.72, 0.46].map((radius) =>
          circle(origin, radius, "front", Math.PI, tau),
        ),
        circle(origin, 1, "ground").map((p) =>
          p.multiply(new Vector3(1, 1, 0.35)),
        ),
      ];
    case "comb":
      return [
        [new Vector3(-0.9, -0.2, 0), new Vector3(0.9, -0.2, 0)],
        ...[-0.8, -0.4, 0, 0.4, 0.8].map((x) =>
          Array.from({ length: 13 }, (_, at) => {
            const t = at / 12;
            return new Vector3(
              x + Math.sin(t * 5 + x) * 0.1,
              -0.2 + t * 1.6,
              0,
            );
          }),
        ),
      ];
    case "knot":
      return [
        Array.from({ length: 97 }, (_, at) => {
          const t = (at / 96) * tau;
          const s = 1 + Math.sin(t) ** 2;
          return new Vector3(
            Math.cos(t) / s,
            (Math.sin(t) * Math.cos(t)) / s,
            0,
          );
        }),
        circle(origin, 1.1, "front"),
      ];
    case "knock":
      return [
        Array.from({ length: 121 }, (_, at) => {
          const t = at / 120;
          const angle = t * tau * 3;
          return new Vector3(
            Math.cos(angle),
            Math.sin(angle),
            0,
          ).multiplyScalar(0.12 + t * 0.95);
        }),
        circle(origin, 0.55, "front"),
        circle(origin, 1.1, "front"),
      ];
    case "split":
      return [
        circle(new Vector3(-0.42, 0, 0), 0.8, "front"),
        circle(new Vector3(0.42, 0, 0), 0.8, "front"),
        [new Vector3(0, -0.85, 0), new Vector3(0, 0.85, 0)],
      ];
    case "letgo":
      return [
        Array.from({ length: 121 }, (_, at) => {
          const t = at / 120;
          const angle = t * tau * 2.5;
          return new Vector3(
            Math.cos(angle) * (0.15 + t * 0.9),
            t * 1.6,
            Math.sin(angle) * (0.15 + t * 0.9),
          );
        }),
      ];
    case "shield": {
      const rings = [0.2, 0.4, 0.6, 0.8].map((y) =>
        circle(
          new Vector3(0, y, 0),
          Math.sin(Math.acos((y - 0.5) / 0.5)) * 0.5,
          "ground",
        ),
      );
      const meridians = [0, 1, 2, 3, 4, 5].map((index) =>
        circle(new Vector3(0, 0.5, 0), 0.5, "front").map((p) =>
          p
            .sub(new Vector3(0, 0.5, 0))
            .applyAxisAngle(new Vector3(0, 1, 0), (index / 6) * Math.PI)
            .add(new Vector3(0, 0.5, 0)),
        ),
      );
      return [...meridians, ...rings];
    }
    case "field":
      return Array.from({ length: 10 }, (_, index) => {
        const around = (index / 10) * tau;
        return Array.from({ length: 49 }, (__, at) => {
          const angle = (at / 48) * tau;
          const out = 0.13 + Math.cos(angle) * 0.24;
          return new Vector3(
            Math.cos(around) * out,
            0.52 + Math.sin(angle) * 0.42,
            Math.sin(around) * out,
          );
        });
      });
    case "flower":
      return [
        circle(origin, 1, "ground"),
        ...Array.from({ length: 6 }, (_, index) => {
          const angle = (index / 6) * tau;
          return circle(
            new Vector3(Math.cos(angle), 0, Math.sin(angle)),
            1,
            "ground",
          );
        }),
        circle(origin, 2, "ground", 0, tau, 96),
      ];
    case "star": {
      const up = [0, 1, 2].map((index) => {
        const angle = (index / 3) * tau;
        return new Vector3(
          Math.cos(angle) * 0.47,
          0.33,
          Math.sin(angle) * 0.47,
        );
      });
      const down = up.map((p) => new Vector3(-p.x, 1 - p.y, -p.z));
      const apex = new Vector3(0, 1, 0);
      const foot = new Vector3(0, 0, 0);
      const edges = (base: Vector3[], tip: Vector3): Vector3[][] =>
        base.flatMap((p, index) => [
          [p, base[(index + 1) % 3] ?? p],
          [p, tip],
        ]);
      return [...edges(up, apex), ...edges(down, foot)];
    }
  }
}
