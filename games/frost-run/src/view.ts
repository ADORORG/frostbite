import { FlatScreen } from "./screen/flat.ts";
import type { Frame } from "./screen/camera.ts";
import type { Moment } from "./screen/happen.ts";
import { loadModels } from "./screen/models/load.ts";
import { GameScreen, type Shown } from "./screen/screen.ts";
import { createStage } from "./screen/stage.ts";

// What draws the game: the 3D screen where the browser has WebGL 2, or the flat one where it has not (an old browser, a locked-down
// machine, a test page). Both are told the same things and both play the same sounds, so a run is the same run either way.
export interface GameView {
  readonly depth: boolean;
  readonly begin: (lead: number) => void;
  readonly resize: () => void;
  readonly select: (index: number) => void;
  readonly show: (dt: number, shown: Shown | null) => void;
  readonly snapshot: () => string;
}

export interface ViewParts {
  readonly canvas: HTMLCanvasElement;
  readonly moment: Moment;
  readonly ratio: () => number;
  // Where the hero select leaves its hero in sight, asked again whenever the screen changes size.
  readonly room: () => Frame;
  readonly touch: boolean;
}

// Whether the player has asked for less motion: the camera then cuts where it would sweep.
const stillness = (): boolean =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function flatView({ canvas, moment, ratio }: ViewParts): GameView {
  const flat = new FlatScreen(canvas, canvas.getContext("2d"), moment);
  flat.resize(ratio());
  return {
    begin: (lead) => flat.begin(lead),
    depth: false,
    resize: () => flat.resize(ratio()),
    select: (index) => flat.select(index),
    show: (_dt, shown) => flat.show(shown),
    snapshot: () => flat.snapshot(),
  };
}

export async function createView(parts: ViewParts): Promise<GameView> {
  const stage = createStage(parts.canvas, parts.touch);
  if (stage === null) return flatView(parts);
  const screen = new GameScreen(
    stage,
    await loadModels(),
    parts.moment,
    stillness,
  );
  const fit = (): void => {
    stage.resize();
    screen.frame(parts.room());
  };
  fit();
  return {
    begin: (lead) => screen.begin(lead),
    depth: true,
    resize: fit,
    select: (index) => screen.select(index),
    show: (dt, shown) => {
      screen.show(dt, shown);
      stage.frameTook(dt * 1000);
    },
    snapshot: () => screen.snapshot(),
  };
}
