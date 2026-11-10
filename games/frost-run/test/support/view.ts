import type { RunInput } from "@frostbite/game-sdk/run-record";
import { vi, type Mock } from "vitest";

import { advanceTo, type RunState } from "../../src/rules/index.ts";
import type { Moment } from "../../src/screen/happen.ts";
import { loadModels, type Models } from "../../src/screen/models/load.ts";
import {
  buildStage,
  type Stage,
  type StageRenderer,
} from "../../src/screen/stage.ts";
import { start, step } from "./rules.ts";

// A renderer that draws nothing, in place of three's (a test has no WebGL), and notes each frame it is asked for.
export interface FakeRenderer {
  readonly domElement: HTMLCanvasElement;
  readonly render: Mock;
  readonly setPixelRatio: Mock;
  readonly setSize: Mock;
  readonly shadowMap: { enabled: boolean; type: number };
}

export function fakeRenderer(): {
  readonly renderer: FakeRenderer;
  readonly stand: StageRenderer;
} {
  const canvas = document.createElement("canvas");
  canvas.toDataURL = () => "data:image/png;base64,AAAA";
  const renderer = {
    domElement: canvas,
    outputColorSpace: "",
    render: vi.fn(),
    setClearColor: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    shadowMap: { enabled: false, type: 0 },
    toneMapping: 0,
    toneMappingExposure: 1,
  };
  return { renderer, stand: renderer as unknown as StageRenderer };
}

export const fakeStage = (
  touch = false,
  ask = "",
): { readonly renderer: FakeRenderer; readonly stage: Stage } => {
  const { renderer, stand } = fakeRenderer();
  return { renderer, stage: buildStage(stand, touch, ask) };
};

export const fakeMoment = (): {
  readonly flash: Mock<() => void>;
  readonly sfx: Mock<Moment["sfx"]>;
  readonly shot: Mock<() => void>;
} => ({
  flash: vi.fn<() => void>(),
  sfx: vi.fn<Moment["sfx"]>(),
  shot: vi.fn<() => void>(),
});

let loaded: Promise<Models> | null = null;
// The models, parsed once for a whole file of tests.
export const models = (): Promise<Models> => (loaded ??= loadModels());

// Every tick of a run, as the screen is shown it: the state a tick before and the state now.
export function* frames(
  seed: number,
  inputs: readonly RunInput[],
): Generator<readonly [RunState, RunState]> {
  let state = start(seed);
  for (const input of inputs) {
    const at =
      input.type === "p" && Array.isArray(input.data)
        ? Number(input.data[0])
        : input.type === "end"
          ? Number(input.data)
          : state.tick;
    while (state.tick < at && !state.ended) {
      const before = state;
      state = advanceTo(state, state.tick + 1);
      yield [before, state];
    }
    if (!state.ended || input.type !== "end")
      state = step(state, input.type, input.data as number | number[]);
  }
}
