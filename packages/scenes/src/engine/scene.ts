// What a scene draws on. Only these three members are used, so a canvas context fits (it has them) and so does a recording stand-in in a
// test, and the engine needs no DOM.
export interface Surface {
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  fillRect(x: number, y: number, width: number, height: number): void;
}

// Scenes are drawn at this size and scaled up by the page, crisp, so every scene costs the same few thousand pixels however large the
// box it fills.
export const sceneWidth = 160;
export const sceneHeight = 90;

// One scene made and ready to draw: how long it runs before it starts over, and a drawing of any moment inside that. `draw` is a pure
// function of `t` (seconds from the start of the loop), so a frame can be drawn at any time, a loop closes without a jump, and a still
// frame is simply one moment.
export interface SceneFrame {
  readonly draw: (surface: Surface, t: number) => void;
  readonly loopSeconds: number;
}

// A scene as the platform lists it. `make` does the one-time work (a simulation, a random layout) and returns the frame drawer.
export interface Scene {
  readonly id: string;
  readonly make: () => SceneFrame;
  readonly name: string;
}
