import { canvasScale, sizeOf, type Shape } from "./layout.ts";

// The screen is tall on a phone held upright, which is where the game SDK's phone stylesheet lays the page out for one: the two use the same query,
// so the page and the screen change together.
export const phoneQuery = "(max-width: 46rem) and (orientation: portrait)";

type Media = Pick<MediaQueryList, "addEventListener" | "matches">;

export const phoneMedia = (): Media | null =>
  typeof window.matchMedia === "function"
    ? window.matchMedia(phoneQuery)
    : null;

const shapeOf = (matches: boolean): Shape => (matches ? "tall" : "wide");

// Tells `apply` which shape the screen has now, and again whenever it changes. Without a way to ask (no media query), it is wide.
export function watchShape(
  media: Media | null,
  apply: (shape: Shape) => void,
): void {
  apply(shapeOf(media?.matches === true));
  media?.addEventListener("change", (event) => apply(shapeOf(event.matches)));
}

// Gives the canvas the pixels of the shape, and says which shape it is so the page can size the box to it.
export function fitCanvas(
  canvas: Pick<HTMLCanvasElement, "dataset" | "height" | "width">,
  shape: Shape,
): void {
  const { height, width } = sizeOf(shape);
  canvas.width = width * canvasScale;
  canvas.height = height * canvasScale;
  canvas.dataset.shape = shape;
}
