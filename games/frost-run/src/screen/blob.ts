import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Texture,
} from "three";

// A soft round shadow on the floor under anything that leaves the ground, so a hop reads as height. Real shadows come from the moon when
// the screen can afford them; this one is always there, and shrinks and fades as what casts it rises.
let shared: Texture | null = null;

function texture(): Texture {
  if (shared !== null) return shared;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context !== null) {
    const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
    gradient.addColorStop(0, "rgba(2, 8, 18, 0.9)");
    gradient.addColorStop(0.55, "rgba(2, 8, 18, 0.45)");
    gradient.addColorStop(1, "rgba(2, 8, 18, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  shared = new CanvasTexture(canvas);
  shared.colorSpace = SRGBColorSpace;
  return shared;
}

const plane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

export function makeBlob(
  size: number,
  strength = 0.55,
): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const material = new MeshBasicMaterial({
    depthWrite: false,
    map: texture(),
    opacity: strength,
    transparent: true,
  });
  const blob = new Mesh(plane, material);
  blob.scale.setScalar(size);
  blob.renderOrder = 1;
  blob.userData.strength = strength;
  return blob;
}

// Places a blob under something `height` metres up: smaller and fainter the higher it is.
export function placeBlob(
  blob: Mesh<PlaneGeometry, MeshBasicMaterial>,
  x: number,
  z: number,
  height: number,
  size: number,
  floor = 0.02,
): void {
  const lift = Math.max(0, height);
  const fade = 1 / (1 + lift * 0.7);
  blob.position.set(x, floor, z);
  blob.scale.setScalar(size * (0.55 + 0.45 * fade));
  const strength =
    typeof blob.userData.strength === "number" ? blob.userData.strength : 0.55;
  blob.material.opacity = strength * fade;
}
