// The screen is drawn small, on a grid of whole pixels, and scaled up by `canvasScale` when it is put on the canvas. A cell of the maze is
// `cell` pixels square, and the maze is centred under the bar of writing at the top.
export const screenWidth = 160;
export const screenHeight = 90;
export const canvasScale = 4;
export const cell = 8;
export const barHeight = 13;

// The top left pixel of the maze, for one that is `width` by `height` cells.
export const originOf = (
  width: number,
  height: number,
): { readonly x: number; readonly y: number } => ({
  x: Math.floor((screenWidth - width * cell) / 2),
  y: barHeight + Math.floor((screenHeight - barHeight - height * cell) / 2),
});

// The middle of the lantern's cell on the screen, in screen pixels, for the lantern in cell `position` of a maze `width` by `height` cells.
export const lanternPoint = (
  width: number,
  height: number,
  position: number,
): { readonly x: number; readonly y: number } => {
  const origin = originOf(width, height);
  return {
    x: origin.x + (position % width) * cell + cell / 2,
    y: origin.y + Math.floor(position / width) * cell + cell / 2,
  };
};
