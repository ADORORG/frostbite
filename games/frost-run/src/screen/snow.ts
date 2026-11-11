import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  type Scene,
  type Vector3,
} from "three";

// Snow falling through the light, in a box that travels with the camera's view. It drifts on a slow sine, and frost vision slows it with
// the rest of the world.
const box = { depth: 34, height: 14, width: 34 };

function flake(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (context !== null) {
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 15);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(220,240,255,0.55)");
    gradient.addColorStop(1, "rgba(220,240,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export class Snowfall {
  private readonly points: Points<BufferGeometry, PointsMaterial>;
  private readonly places: Float32Array;
  private readonly drift: Float32Array;
  private clock = 0;

  constructor(
    scene: Scene,
    private readonly capacity: number,
  ) {
    this.places = new Float32Array(capacity * 3);
    this.drift = new Float32Array(capacity);
    for (let at = 0; at < capacity; at += 1) {
      // Spread on a low-discrepancy pattern, so the box looks evenly snowy with no random numbers.
      this.places[at * 3] = (((at * 0.7548776662) % 1) - 0.5) * box.width;
      this.places[at * 3 + 1] = ((at * 0.5698402909) % 1) * box.height;
      this.places[at * 3 + 2] = (((at * 0.3819660113) % 1) - 0.5) * box.depth;
      this.drift[at] = (at * 0.618034) % 1;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.places, 3));
    const material = new PointsMaterial({
      blending: AdditiveBlending,
      color: "#dff2ff",
      depthWrite: false,
      map: flake(),
      opacity: 0.85,
      size: 0.13,
      sizeAttenuation: true,
      transparent: true,
    });
    this.points = new Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  // How many flakes to draw (the quality ladder sets it).
  setCount(count: number): void {
    this.points.geometry.setDrawRange(0, Math.min(this.capacity, count));
  }

  update(dt: number, around: Vector3, slow: number): void {
    this.clock += dt * slow;
    const step = dt * slow;
    const wrap = (value: number, centre: number, span: number): number => {
      const off = value - centre;
      return off > span / 2
        ? value - span
        : off < -span / 2
          ? value + span
          : value;
    };
    for (let at = 0; at < this.capacity; at += 1) {
      const k = at * 3;
      const drift = this.drift[at] ?? 0;
      let y = (this.places[k + 1] ?? 0) - step * (0.6 + drift * 0.7);
      if (y < 0) y += box.height;
      this.places[k + 1] = y;
      const x =
        (this.places[k] ?? 0) +
        Math.sin(this.clock * 0.7 + drift * 20) * step * 0.25;
      this.places[k] = wrap(x, around.x, box.width);
      this.places[k + 2] = wrap(this.places[k + 2] ?? 0, around.z, box.depth);
    }
    const place = this.points.geometry.getAttribute("position");
    place.needsUpdate = true;
  }
}
