import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  Vector3,
} from "three";

// A body is grown, not assembled: each part (torso, an arm, a leg, a finger) is a run of rings swept along the bones at rest, each ring an
// oval (or a softened square) of its own width and depth, joined into one smooth skin. Every point of the skin is bound to the bones
// around it, blended across a joint, so an elbow bends as one surface and never shows a seam.
export type Influence = readonly (readonly [number, number])[];

export interface Ring {
  readonly bones: Influence;
  readonly centre: Vector3;
  // Half the ring's width (along x) and depth (along z), or for a ring that runs front to back (a foot), its height.
  readonly rx: number;
  readonly rz: number;
  // 2 is an oval; above 2 squarer.
  readonly round?: number;
  // Which way the ring faces: "y" for a part that runs up and down (the default), "z" for one that runs front to back.
  readonly runs?: "y" | "z";
  // Pushes the front of the ring forward (a chest, a belly, a calf), by this share of its depth.
  readonly front?: number;
}

export class SkinBuilder {
  private readonly positions: number[] = [];
  private readonly uvs: number[] = [];
  private readonly indices: number[] = [];
  private readonly skinIndex: number[] = [];
  private readonly skinWeight: number[] = [];
  private readonly colours: number[] = [];

  private vertex(
    at: Vector3,
    u: number,
    v: number,
    bones: Influence,
    shade: number,
  ): number {
    const index = this.positions.length / 3;
    this.positions.push(at.x, at.y, at.z);
    this.uvs.push(u, v);
    this.colours.push(shade, shade, shade);
    const top = [...bones].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = top.reduce((sum, [, weight]) => sum + weight, 0) || 1;
    for (let at4 = 0; at4 < 4; at4 += 1) {
      const pair = top[at4];
      this.skinIndex.push(pair?.[0] ?? 0);
      this.skinWeight.push(pair === undefined ? 0 : pair[1] / total);
    }
    return index;
  }

  // Joins two rows of a tube with outward-facing triangles: `ahead` is whether the second row lies the way that winds outward (up the
  // y axis for upright parts, back along z for parts that run front to back).
  private join(
    from: number,
    to: number,
    segments: number,
    ahead: boolean,
  ): void {
    for (let at = 0; at < segments; at += 1) {
      const a = from + at;
      const b = from + ((at + 1) % segments);
      const c = to + at;
      const d = to + ((at + 1) % segments);
      if (ahead) this.indices.push(a, c, b, b, c, d);
      else this.indices.push(a, b, c, b, d, c);
    }
  }

  // Closes an end with a dome: rings shrinking round a quarter circle to a point, `out` along the part's axis.
  private dome(
    ring: Ring,
    row: number,
    segments: number,
    out: number,
    ahead: boolean,
    v: number,
    shade: number,
  ): void {
    const depth = Math.min(ring.rx, ring.rz) * 0.8;
    const along = (lift: number): Vector3 =>
      ring.runs === "z"
        ? new Vector3(0, 0, out * lift)
        : new Vector3(0, out * lift, 0);
    const offsets = Array.from({ length: segments }, (_, at) =>
      new Vector3(
        this.positions[(row + at) * 3] ?? 0,
        this.positions[(row + at) * 3 + 1] ?? 0,
        this.positions[(row + at) * 3 + 2] ?? 0,
      ).sub(ring.centre),
    );
    let previous = row;
    for (const angle of [0.55, 1.0, 1.32]) {
      const start = this.positions.length / 3;
      const centre = ring.centre.clone().add(along(Math.sin(angle) * depth));
      offsets.forEach((offset, at) =>
        this.vertex(
          centre.clone().addScaledVector(offset, Math.cos(angle)),
          at / segments,
          v,
          ring.bones,
          shade,
        ),
      );
      this.join(previous, start, segments, ahead);
      previous = start;
    }
    const tip = this.vertex(
      ring.centre.clone().add(along(depth)),
      0.5,
      v,
      ring.bones,
      shade,
    );
    for (let at = 0; at < segments; at += 1) {
      const a = previous + at;
      const b = previous + ((at + 1) % segments);
      if (ahead) this.indices.push(a, tip, b);
      else this.indices.push(a, b, tip);
    }
  }

  // Sweeps rings into a tube, closed with a dome at either end that asks for it; `shade` darkens the vertex colour (for soft creases and
  // the inside of a skirt). The texture runs once round each ring and `stretch` times along the part.
  sweep(
    rings: readonly Ring[],
    segments: number,
    caps: { readonly end: boolean; readonly start: boolean },
    stretch = 1,
    shade = 1,
  ): void {
    const first = this.positions.length / 3;
    rings.forEach((ring, row) => {
      const power = 2 / (ring.round ?? 2);
      for (let at = 0; at < segments; at += 1) {
        const angle = (at / segments) * Math.PI * 2;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const x = Math.sign(c) * Math.abs(c) ** power * ring.rx;
        const across =
          Math.sign(s) *
          Math.abs(s) ** power *
          ring.rz *
          (s > 0 ? 1 + (ring.front ?? 0) : 1);
        const point =
          ring.runs === "z"
            ? new Vector3(
                ring.centre.x + x,
                ring.centre.y + across,
                ring.centre.z,
              )
            : new Vector3(
                ring.centre.x + x,
                ring.centre.y,
                ring.centre.z + across,
              );
        this.vertex(
          point,
          at / segments,
          (row / Math.max(1, rings.length - 1)) * stretch,
          ring.bones,
          shade,
        );
      }
    });
    const head = rings[0];
    const next = rings[1];
    const tail = rings[rings.length - 1];
    if (head === undefined || tail === undefined) return;
    const runsZ = head.runs === "z";
    const step =
      next === undefined
        ? 1
        : runsZ
          ? next.centre.z - head.centre.z
          : next.centre.y - head.centre.y;
    // Up (or back along z) winds outward as the rows are made; the other way, the triangles are turned.
    const ahead = runsZ ? step < 0 : step > 0;
    for (let row = 0; row < rings.length - 1; row += 1)
      this.join(
        first + row * segments,
        first + (row + 1) * segments,
        segments,
        ahead,
      );
    const forward = step > 0 ? 1 : -1;
    if (caps.start)
      this.dome(head, first, segments, -forward, !ahead, 0, shade);
    if (caps.end)
      this.dome(
        tail,
        first + (rings.length - 1) * segments,
        segments,
        forward,
        ahead,
        stretch,
        shade,
      );
  }

  geometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(this.positions, 3),
    );
    geometry.setAttribute("uv", new Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute("color", new Float32BufferAttribute(this.colours, 3));
    geometry.setAttribute(
      "skinIndex",
      new Uint16BufferAttribute(this.skinIndex, 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new Float32BufferAttribute(this.skinWeight, 4),
    );
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}
