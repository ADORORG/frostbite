// The screen is drawn small, on a grid of whole pixels, and scaled up by `canvasScale` when it is put on the canvas. One pixel is
// `subPerPixel` sub-units of the rules' world; the snowball stays at `ballX` and the world scrolls past it.
export const screenWidth = 160;
export const screenHeight = 90;
export const canvasScale = 4;
export const subPerPixel = 6;
export const groundY = 68;
export const ballX = 24;

export const px = (units: number): number => Math.round(units / subPerPixel);

// Where, across the screen, a place in the world is when the snowball has come `distance`.
export const screenX = (x: number, distance: number): number =>
  ballX + px(x - distance);

// Where, down the screen, a height over the snow is.
export const screenY = (height: number): number => groundY - px(height);
