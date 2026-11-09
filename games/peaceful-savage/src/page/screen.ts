import type { Card as GuideCard } from "@frostbite/game-sdk/guide";
import { createGuideLayer } from "@frostbite/game-sdk/guide-layer";
import { isTouchScreen } from "@frostbite/game-sdk/touch";

import type { PlayState } from "../rules/types.ts";
import { drawMap, mapHeight, mapWidth } from "../screen/map.ts";
import { startingQuality } from "../view/stage.ts";
import type { StageControl } from "../view/show.ts";
import { createDepthView, type DepthView } from "../view/view.ts";
import type { Card, CardMaker } from "./cards.ts";
import { element } from "./elements.ts";
import type { Hud } from "./hud.ts";
import type { MomentPanel } from "./moment.ts";
import type { Overlay } from "./overlay.ts";
import type { Select } from "./select.ts";
import { type Ground, north } from "./steer.ts";

// The screen and everything over it: the three-dimensional view (made once the platform has answered, since making it takes a moment
// and the first-screen card covers the screen meanwhile) or, where WebGL 2 cannot be had, the flat map on the screen's own canvas; then
// the prompt and toasts, the moment, the readouts, the card over the screen, and a share card's picture when one is due.
export interface ScreenFrame {
  readonly alpha: number;
  readonly best: number;
  // The first-screen card, the card after a run, or nothing.
  readonly card: GuideCard | null;
  readonly previous: PlayState;
  readonly running: boolean;
  // The show at the end: who the player moves on the stage, and where.
  readonly stage?: StageControl | null;
  readonly state: PlayState;
  readonly time: number;
}

export interface Screen {
  // Makes the three-dimensional view; false where it cannot be made.
  readonly build: () => boolean;
  readonly draw: (frame: ScreenFrame) => void;
  // The way the camera looks, for steering by the screen.
  readonly forward: () => Ground;
}

export interface ScreenParts {
  readonly cards: CardMaker;
  readonly hud: Hud;
  readonly moment: MomentPanel;
  readonly onCard: (card: Card) => void;
  readonly overlay: Overlay;
  readonly select: Select;
}

export function createScreen(parts: ScreenParts): Screen {
  const screen = element("screen", "canvas");
  const world = element("world", "canvas");
  const layer = createGuideLayer(screen);
  screen.width = mapWidth;
  screen.height = mapHeight;
  let depth: DepthView | null = null;
  let flat: CanvasRenderingContext2D | null = null;
  return {
    build() {
      depth = createDepthView(
        world,
        startingQuality(isTouchScreen(), navigator.hardwareConcurrency || 4),
      );
      world.hidden = depth === null;
      flat = depth === null ? screen.getContext("2d") : null;
      return depth !== null;
    },
    draw(frame) {
      const { state } = frame;
      const chosen = parts.select.chosen();
      if (depth !== null)
        depth.show({
          alpha: frame.alpha,
          previous: frame.previous,
          select: chosen,
          stage: frame.stage ?? null,
          state,
        });
      else if (flat !== null) drawMap(flat, state, chosen, frame.time / 1000);
      // The picture for a share card is taken straight after the screen is drawn, while the frame is still there to copy.
      const card = parts.cards.snap(
        depth !== null ? world : flat === null ? null : screen,
        frame.time,
      );
      if (card !== null) parts.onCard(card);
      parts.overlay.show(state, frame.time);
      parts.moment.show(state);
      parts.hud.show(state, frame.best, frame.running);
      layer.show(frame.card);
    },
    forward: () => depth?.forward() ?? north,
  };
}
