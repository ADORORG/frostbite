import { colour } from "./palette.ts";
import { write } from "./text.ts";

// The mark over the screen in test mode, where the quest's clock would be.
export function drawTestMark(context: CanvasRenderingContext2D): void {
  context.fillStyle = "rgb(12 6 32 / 0.72)";
  context.fillRect(100, 1, 56, 10);
  write(context, "TEST MODE", 128, 2, 8, colour.pink);
}
