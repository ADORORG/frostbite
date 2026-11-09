import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// The stage the world is drawn on: a WebGL renderer on the page's world canvas (behind the game screen, whose words are drawn over it),
// filmic tone mapping, soft shadows from one key light that follows the lead, a sky light (cool above, purple from below, the book's
// shadows), fog, and a soft bloom so every line of gold, every lit window and every firefly glows. Its light warms from cold moonlight
// to the book's gold as colour comes back. Where the browser has no WebGL 2 there is no stage, and the screen draws a flat map instead.
export interface Quality {
  // How sharp the picture is (device pixels per CSS pixel, at most).
  readonly pixels: number;
  // Whether bodies and things cast shadows, and how fine they are.
  readonly shadows: number;
  // How much hair, grass and such to grow (0.3 to 1).
  readonly amount: number;
  // How smooth curved things are (1 to 3).
  readonly detail: number;
  // Whether lamps give real light.
  readonly lights: boolean;
  // Whether glowing things bloom.
  readonly bloom: boolean;
}

export const qualities: readonly Quality[] = [
  {
    amount: 0.35,
    bloom: false,
    detail: 1,
    lights: false,
    pixels: 1,
    shadows: 0,
  },
  {
    amount: 0.65,
    bloom: true,
    detail: 2,
    lights: true,
    pixels: 1.5,
    shadows: 1024,
  },
  { amount: 1, bloom: true, detail: 2, lights: true, pixels: 2, shadows: 2048 },
];

interface Glow {
  render(): void;
  resize(width: number, height: number, ratio: number): void;
}

// The bloom: the scene drawn, its brightest parts blurred back over it, then tone mapped. Null where it cannot be made.
function glowFor(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
): Glow | null {
  try {
    const composer = new EffectComposer(renderer);
    const bloom = new UnrealBloomPass(new Vector2(640, 360), 0.38, 0.4, 1.0);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return {
      render() {
        composer.render();
      },
      resize(width, height, ratio) {
        composer.setPixelRatio(ratio);
        composer.setSize(width, height);
      },
    };
  } catch {
    return null;
  }
}

// A phone, a tablet or a machine with few cores starts at the middle step; anything else at the top.
export function startingQuality(coarse: boolean, cores: number): number {
  if (coarse || cores <= 4) return 1;
  return 2;
}

export interface Stage {
  readonly camera: PerspectiveCamera;
  // Fits the picture to its box, filling it.
  fit(): void;
  // Sets the lens for a shot framed at 16 by 9: on a box narrower than that the view widens, so the sides of the shot stay in.
  lens(fov: number): void;
  render(): void;
  readonly scene: Scene;
  // Moves the key light's shadows to where the lead is.
  follow(at: Vector3): void;
  // Warms the light from moonlight (0) to gold (1).
  warm(amount: number): void;
}

export const aspect = 16 / 9;

export function createStage(
  canvas: HTMLCanvasElement,
  quality: Quality,
): Stage | null {
  if (typeof WebGL2RenderingContext === "undefined") return null;
  const context = canvas.getContext("webgl2", {
    antialias: quality.pixels < 2,
    powerPreference: "high-performance",
  });
  if (!(context instanceof WebGL2RenderingContext)) return null;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, context });
  } catch {
    return null;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.7;
  renderer.shadowMap.enabled = quality.shadows > 0;
  renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  const night = new Color("#1b1440");
  scene.background = night.clone();
  scene.fog = new FogExp2(night.getHex(), 0.018);
  const sky = new HemisphereLight("#9fb2ff", "#5b3f86", 0.7);
  scene.add(sky);
  const fill = new AmbientLight("#6b5aa8", 0.15);
  scene.add(fill);
  const key = new DirectionalLight("#c9d4ff", 0.9);
  key.castShadow = quality.shadows > 0;
  key.shadow.mapSize.set(quality.shadows || 1, quality.shadows || 1);
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 14;
  key.shadow.camera.bottom = -14;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const camera = new PerspectiveCamera(50, aspect, 0.08, 160);
  const glow = quality.bloom ? glowFor(renderer, scene, camera) : null;
  const offset = new Vector3(-9, 22, -14);
  const moon = new Color("#c9d4ff");
  const gold = new Color("#ffe6bf");
  const coolSky = new Color("#9fb2ff");
  const warmSky = new Color("#ffe1b0");
  const dusk = new Color("#3a2a5e");
  let fitted = "";
  return {
    camera,
    fit() {
      const boxWidth = canvas.clientWidth > 0 ? canvas.clientWidth : 640;
      const boxHeight = canvas.clientHeight > 0 ? canvas.clientHeight : 360;
      const width = Math.round(boxWidth);
      const height = Math.round(boxHeight);
      const ratio = Math.min(quality.pixels, globalThis.devicePixelRatio || 1);
      const size = `${String(width)}x${String(height)}@${String(ratio)}`;
      if (size === fitted) return;
      fitted = size;
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      glow?.resize(width, height, ratio);
    },
    lens(fov) {
      const shape = camera.aspect;
      camera.fov =
        shape >= aspect
          ? fov
          : (2 *
              Math.atan(Math.tan((fov * Math.PI) / 360) * (aspect / shape)) *
              180) /
            Math.PI;
      camera.updateProjectionMatrix();
    },
    follow(at) {
      key.target.position.copy(at);
      key.position.copy(at).add(offset);
    },
    render() {
      if (glow === null) renderer.render(scene, camera);
      else glow.render();
    },
    scene,
    warm(amount) {
      const t = Math.min(1, Math.max(0, amount));
      key.color.copy(moon).lerp(gold, t);
      key.intensity = 0.9 + t * 0.6;
      sky.color.copy(coolSky).lerp(warmSky, t * 0.6);
      sky.intensity = 0.7 + t * 0.2;
      const back = night.clone().lerp(dusk, t);
      scene.background = back;
      if (scene.fog instanceof FogExp2) scene.fog.color.copy(back);
    },
  };
}
