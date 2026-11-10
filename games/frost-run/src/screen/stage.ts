import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";

// The stage every scene is played on: the renderer, a cold night (the page's own near-black, with a light fog), a sky-and-snow fill, a
// moon that casts the shadows, a cool rim from behind, and one warm light that waits for the crystal flash. It sizes itself to its box and
// steps its quality down (and back up) by how long frames really take, so a phone stays smooth.
export const night = new Color("#0B0A08");

export interface Quality {
  readonly level: number;
  readonly pixelRatio: number;
  readonly shadows: number;
  readonly snow: number;
}

const ladder: readonly Quality[] = [
  { level: 0, pixelRatio: 0.85, shadows: 0, snow: 250 },
  { level: 1, pixelRatio: 1.25, shadows: 1024, snow: 600 },
  { level: 2, pixelRatio: 1.6, shadows: 1024, snow: 1000 },
  { level: 3, pixelRatio: 2, shadows: 2048, snow: 1500 },
];

// The parts of three's renderer the stage uses, so a test can stand in for it.
export type StageRenderer = Pick<
  WebGLRenderer,
  | "domElement"
  | "outputColorSpace"
  | "render"
  | "setClearColor"
  | "setPixelRatio"
  | "setSize"
  | "shadowMap"
  | "toneMapping"
  | "toneMappingExposure"
>;

export interface Stage {
  readonly camera: PerspectiveCamera;
  readonly flash: PointLight;
  readonly moon: DirectionalLight;
  readonly quality: () => Quality;
  readonly renderer: StageRenderer;
  readonly scene: Scene;
  readonly sky: HemisphereLight;
  // Follows the moon's shadow to a point on the floor, so the shadows near the player stay sharp.
  readonly aim: (at: Vector3) => void;
  readonly frameTook: (ms: number) => void;
  readonly onQuality: (listener: (quality: Quality) => void) => void;
  readonly render: () => void;
  readonly resize: () => void;
}

export function createStage(
  canvas: HTMLCanvasElement,
  touch: boolean,
): Stage | null {
  if (typeof WebGL2RenderingContext === "undefined") return null;
  const context = canvas.getContext("webgl2", {
    alpha: false,
    antialias: !touch,
    powerPreference: "high-performance",
  });
  if (!(context instanceof WebGL2RenderingContext)) return null;
  try {
    return buildStage(
      new WebGLRenderer({ antialias: !touch, canvas, context }),
      touch,
      window.location.search,
    );
  } catch {
    return null;
  }
}

// The stage around a renderer: `ask` is the page's query, where `?quality=0` to `3` asks for a quality.
export function buildStage(
  renderer: StageRenderer,
  touch: boolean,
  ask: string,
): Stage {
  renderer.setClearColor(night);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.background = night;
  scene.fog = new Fog(night, 22, 58);
  const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 200);

  const sky = new HemisphereLight("#cfe8ff", "#1b2633", 1.25);
  scene.add(sky);
  const moon = new DirectionalLight("#e2efff", 2.1);
  moon.position.set(-7, 15, 9);
  moon.shadow.camera.left = -13;
  moon.shadow.camera.right = 13;
  moon.shadow.camera.top = 13;
  moon.shadow.camera.bottom = -13;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 45;
  moon.shadow.bias = -0.0008;
  moon.shadow.normalBias = 0.03;
  scene.add(moon, moon.target);
  const rim = new DirectionalLight("#7fd8ff", 0.55);
  rim.position.set(5, 6, -12);
  scene.add(rim);
  const flash = new PointLight("#F7931A", 0, 7, 1.6);
  scene.add(flash);

  // A page can ask for a quality (`?quality=0` to `3`); otherwise a phone starts one step down, and the ladder moves from there.
  const asked = Number(new URLSearchParams(ask).get("quality") ?? "-1");
  let level =
    Number.isInteger(asked) && asked >= 0 && asked < ladder.length
      ? asked
      : touch
        ? 2
        : 3;
  let slow = 0;
  let quick = 0;
  let average = 16;
  const listeners: ((quality: Quality) => void)[] = [];
  const current = (): Quality =>
    ladder[level] ?? { level: 1, pixelRatio: 1, shadows: 1024, snow: 600 };

  const resize = (): void => {
    const box = renderer.domElement.parentElement ?? renderer.domElement;
    const width = Math.max(1, box.clientWidth);
    const height = Math.max(1, box.clientHeight);
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, current().pixelRatio),
    );
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // A tall phone sees less from side to side, so it stands a little further back in field of view.
    camera.fov = camera.aspect < 1 ? 64 : 50;
    camera.updateProjectionMatrix();
  };

  const apply = (): void => {
    const quality = current();
    renderer.shadowMap.enabled = quality.shadows > 0;
    moon.castShadow = quality.shadows > 0;
    if (quality.shadows > 0 && moon.shadow.mapSize.x !== quality.shadows) {
      moon.shadow.mapSize.set(quality.shadows, quality.shadows);
      moon.shadow.map?.dispose();
      moon.shadow.map = null;
    }
    resize();
    for (const listener of listeners) listener(quality);
  };
  apply();

  return {
    aim(at) {
      moon.position.set(at.x - 7, 15, at.z + 9);
      moon.target.position.copy(at);
    },
    camera,
    flash,
    // Every frame says how long it took. Two slow seconds step down; eight quick ones step back up.
    frameTook(ms) {
      average += (Math.min(ms, 100) - average) * 0.05;
      slow = average > 22 ? slow + 1 : 0;
      quick = average < 12 ? quick + 1 : 0;
      if (slow > 120 && level > 0) {
        level -= 1;
        slow = 0;
        apply();
      } else if (quick > 480 && level < ladder.length - 1 && !touch) {
        level += 1;
        quick = 0;
        apply();
      }
    },
    moon,
    onQuality(listener) {
      listeners.push(listener);
      listener(current());
    },
    quality: current,
    render: () => renderer.render(scene, camera),
    renderer,
    resize,
    scene,
    sky,
  };
}
