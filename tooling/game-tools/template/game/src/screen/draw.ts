import { zoneHalfWidth } from "../rules/constants.ts";
import type { StarterState } from "../rules/types.ts";
import {
  laneHeight,
  laneLeft,
  laneTop,
  screenHeight,
  screenWidth,
} from "./layout.ts";
import { colour } from "./palette.ts";

// What the screen draws: the state of the run and where the marker is now. Pure drawing, no game logic.
export interface Frame {
  readonly markerAt: number;
  readonly state: StarterState;
}

const markerWidth = 3;

export function draw(context: CanvasRenderingContext2D, frame: Frame): void {
  context.fillStyle = colour.background;
  context.fillRect(0, 0, screenWidth, screenHeight);
  context.fillStyle = colour.lane;
  context.fillRect(laneLeft - 2, laneTop - 2, 104, laneHeight + 4);
  context.strokeStyle = colour.laneEdge;
  context.strokeRect(laneLeft - 2.5, laneTop - 2.5, 105, laneHeight + 5);
  const { zone } = frame.state;
  context.fillStyle = colour.zone;
  context.fillRect(
    laneLeft + zone - zoneHalfWidth,
    laneTop,
    2 * zoneHalfWidth,
    laneHeight,
  );
  context.fillStyle = colour.zoneEdge;
  context.fillRect(laneLeft + zone - 0.5, laneTop, 1, laneHeight);
  context.fillStyle = frame.state.ended ? colour.danger : colour.marker;
  context.fillRect(
    laneLeft + frame.markerAt - markerWidth / 2,
    laneTop - 4,
    markerWidth,
    laneHeight + 8,
  );
}
