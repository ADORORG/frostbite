import {
  AdditiveBlending,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  RingGeometry,
  Vector3,
  type Material,
  type BufferGeometry,
  type Scene,
} from "three";

// Bursts that only the screen sees: puffs of snow, shards of ice, sparks of light and rings on the water. Two pools of instanced bits (lit
// chunks, and glowing sparks that add their light), so a hundred at once cost two draws.
export interface Burst {
  readonly at: Vector3;
  readonly colour: string;
  readonly count: number;
  readonly glow?: boolean;
  readonly lift?: number;
  readonly size?: number;
  readonly speed?: number;
  readonly gravity?: number;
  readonly life?: number;
}

// A value from one of the pool's arrays (they are as long as the pool, so the fallback is never reached).
const read = (values: Float32Array, at: number): number => values[at] ?? 0;

class Pool {
  readonly mesh: InstancedMesh;
  private readonly place: Float32Array;
  private readonly speed: Float32Array;
  private readonly life: Float32Array;
  private readonly span: Float32Array;
  private readonly size: Float32Array;
  private readonly fall: Float32Array;
  private live = 0;
  private readonly matrix = new Matrix4();
  private readonly turn = new Quaternion();
  private readonly axis = new Vector3(0.3, 1, 0.2).normalize();
  private readonly at = new Vector3();
  private readonly scale = new Vector3();
  private readonly colour = new Color();

  constructor(
    geometry: BufferGeometry,
    material: Material,
    private readonly capacity: number,
  ) {
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.place = new Float32Array(capacity * 3);
    this.speed = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.span = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.fall = new Float32Array(capacity);
    for (let at = 0; at < capacity; at += 1)
      this.mesh.setColorAt(at, this.colour.set("#ffffff"));
  }

  burst(spec: Burst, wave: number): void {
    this.colour.set(spec.colour);
    const speed = spec.speed ?? 3;
    for (let index = 0; index < spec.count; index += 1) {
      if (this.live >= this.capacity) return;
      const at = this.live;
      this.live += 1;
      // A spread that looks scattered but is the same every time: the golden angle round, a sine up.
      const round = (index + wave) * 2.39996;
      const up = 0.35 + 0.65 * Math.abs(Math.sin(index * 1.7 + wave));
      const out =
        speed * (0.45 + 0.55 * Math.abs(Math.cos(index * 2.3 + wave * 0.7)));
      this.place.set([spec.at.x, spec.at.y, spec.at.z], at * 3);
      this.speed.set(
        [Math.cos(round) * out, (spec.lift ?? 2.5) * up, Math.sin(round) * out],
        at * 3,
      );
      const life = (spec.life ?? 0.7) * (0.7 + 0.3 * up);
      this.life[at] = life;
      this.span[at] = life;
      this.size[at] = (spec.size ?? 0.08) * (0.6 + 0.8 * up);
      this.fall[at] = spec.gravity ?? 7;
      this.mesh.setColorAt(at, this.colour);
    }
    if (this.mesh.instanceColor !== null)
      this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let at = 0;
    while (at < this.live) {
      const left = read(this.life, at) - dt;
      if (left <= 0) {
        this.live -= 1;
        this.copy(this.live, at);
        continue;
      }
      this.life[at] = left;
      const k = at * 3;
      const fall = read(this.fall, at);
      const vy = read(this.speed, k + 1) - fall * dt;
      this.speed[k + 1] = vy;
      const x = read(this.place, k) + read(this.speed, k) * dt;
      const y = Math.max(0.02, read(this.place, k + 1) + vy * dt);
      const z = read(this.place, k + 2) + read(this.speed, k + 2) * dt;
      this.place.set([x, y, z], k);
      const share = left / read(this.span, at);
      this.at.set(x, y, z);
      this.turn.setFromAxisAngle(this.axis, share * 9 + at);
      this.scale.setScalar(read(this.size, at) * Math.sqrt(share));
      this.mesh.setMatrixAt(
        at,
        this.matrix.compose(this.at, this.turn, this.scale),
      );
      at += 1;
    }
    this.mesh.count = this.live;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private copy(from: number, to: number): void {
    if (from === to) return;
    this.place.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.speed.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.life[to] = read(this.life, from);
    this.span[to] = read(this.span, from);
    this.size[to] = read(this.size, from);
    this.fall[to] = read(this.fall, from);
    this.mesh.getColorAt(from, this.colour);
    this.mesh.setColorAt(to, this.colour);
    if (this.mesh.instanceColor !== null)
      this.mesh.instanceColor.needsUpdate = true;
  }
}

interface Ring {
  readonly mesh: Mesh<RingGeometry, MeshBasicMaterial>;
  age: number;
  span: number;
  reach: number;
}

export class Effects {
  private readonly chunks = new Pool(
    new IcosahedronGeometry(1, 0),
    new MeshStandardMaterial({ flatShading: true, roughness: 0.6 }),
    420,
  );
  private readonly sparks = new Pool(
    new OctahedronGeometry(1, 0),
    new MeshBasicMaterial({
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      transparent: true,
    }),
    360,
  );
  private readonly rings: Ring[] = [];
  private wave = 0;

  constructor(scene: Scene) {
    scene.add(this.chunks.mesh, this.sparks.mesh);
    const geometry = new RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
    for (let at = 0; at < 10; at += 1) {
      const material = new MeshBasicMaterial({
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        transparent: true,
      });
      const mesh = new Mesh(geometry, material);
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ age: 1, mesh, reach: 1, span: 1 });
    }
  }

  burst(spec: Burst): void {
    this.wave += 0.618;
    (spec.glow === true ? this.sparks : this.chunks).burst(spec, this.wave);
  }

  // A ring that spreads on the floor (a splash, a shock, a crystal's pop).
  ring(at: Vector3, colour: string, reach: number, span = 0.6): void {
    const ring = this.rings.reduce((oldest, each) =>
      each.age / each.span > oldest.age / oldest.span ? each : oldest,
    );
    ring.age = 0;
    ring.span = span;
    ring.reach = reach;
    ring.mesh.position.set(at.x, Math.max(0.04, at.y), at.z);
    ring.mesh.material.color.set(colour);
    ring.mesh.visible = true;
  }

  update(dt: number): void {
    this.chunks.update(dt);
    this.sparks.update(dt);
    for (const ring of this.rings) {
      if (!ring.mesh.visible) continue;
      ring.age += dt;
      const share = ring.age / ring.span;
      if (share >= 1) {
        ring.mesh.visible = false;
        continue;
      }
      ring.mesh.scale.setScalar(
        0.2 + ring.reach * (1 - (1 - share) * (1 - share)),
      );
      ring.mesh.material.opacity = 0.85 * (1 - share);
    }
  }
}
