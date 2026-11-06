// The screen is drawn small, on a grid of whole pixels, and scaled up by `canvasScale` when it is put on the canvas. A cell of the maze is
// `cell` pixels square, and the maze is centred under the bar of writing at the top.
export const screenWidth = 160;
export const screenHeight = 90;
export const canvasScale = 4;
export const cell = 8;
export const barHeight = 13;

// A small floor would sit lost in the middle of the screen, so the maze is drawn larger when it can be: by the most that lets it fit, in
// steps of `zoomStep` (a step that is a quarter of the page's scale up lands every pixel on a whole pixel of the canvas), and never smaller
// than it is drawn, so the biggest floors are as they were.
export const zoomStep = 0.25;
const mazeMargin = 2;

export const zoomOf = (width: number, height: number): number => {
  const fit = Math.min(
    (screenWidth - 2 * mazeMargin) / (width * cell),
    (screenHeight - barHeight - 2 * mazeMargin) / (height * cell),
  );
  return Math.max(1, Math.floor(fit / zoomStep) * zoomStep);
};

// The top left pixel of the maze, for one that is `width` by `height` cells.
export const originOf = (
  width: number,
  height: number,
): { readonly x: number; readonly y: number } => {
  const size = cell * zoomOf(width, height);
  return {
    x: Math.floor((screenWidth - width * size) / 2),
    y: barHeight + Math.floor((screenHeight - barHeight - height * size) / 2),
  };
};

// The middle of the lantern's cell on the screen, in screen pixels, and how wide a cell is there, for the lantern in cell `position` of a
// maze `width` by `height` cells.
export const lanternPoint = (
  width: number,
  height: number,
  position: number,
): { readonly size: number; readonly x: number; readonly y: number } => {
  const origin = originOf(width, height);
  const size = cell * zoomOf(width, height);
  return {
    size,
    x: origin.x + (position % width) * size + size / 2,
    y: origin.y + Math.floor(position / width) * size + size / 2,
  };
};
