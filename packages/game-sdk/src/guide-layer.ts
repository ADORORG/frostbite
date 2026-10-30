import { drawGuide, type Guide } from "./guide.ts";

// The first-screen card, drawn over a game's canvas at the pixels of the display and not the pixels of the game. A game's own canvas is small
// (160x90 or 256x144) and is scaled up to the page, which blurs any writing on it; this is a second canvas laid exactly over the first, as big as it
// is shown times the display's pixel ratio, so the card is sharp whatever the size of the page. It takes no touches, takes no place in the
// page's layout, and is hidden when there is no card to show.
export interface GuideLayer {
  // Shows the card, or hides it (null). Showing the same card again does nothing unless the screen has changed size.
  readonly show: (guide: Guide | null) => void;
}

export interface GuideLayerOptions {
  readonly draw?: typeof drawGuide;
  readonly ratio?: () => number;
}

export function createGuideLayer(
  screen: HTMLCanvasElement,
  {
    draw = drawGuide,
    ratio = () => window.devicePixelRatio,
  }: GuideLayerOptions = {},
): GuideLayer {
  const layer = screen.ownerDocument.createElement("canvas");
  layer.setAttribute("aria-hidden", "true");
  // The game's own rules for its canvas (a border, a size, a pixelated look) are for the game's screen, not for this card.
  Object.assign(layer.style, {
    background: "none",
    border: "0",
    borderRadius: "0",
    boxShadow: "none",
    display: "none",
    imageRendering: "auto",
    margin: "0",
    padding: "0",
    pointerEvents: "none",
    position: "fixed",
    zIndex: "2",
  });
  screen.after(layer);
  let current: Guide | null = null;
  let painted = "";

  const paint = (): void => {
    if (current === null) {
      layer.style.display = "none";
      painted = "";
      return;
    }
    const box = screen.getBoundingClientRect();
    const scale = Math.max(1, ratio());
    const key = `${String(box.left)} ${String(box.top)} ${String(box.width)} ${String(box.height)} ${String(scale)}`;
    const context = layer.getContext("2d");
    if (
      context === null ||
      (key === painted && layer.style.display === "block")
    )
      return;
    painted = key;
    Object.assign(layer.style, {
      display: "block",
      height: `${String(box.height)}px`,
      left: `${String(box.left)}px`,
      top: `${String(box.top)}px`,
      width: `${String(box.width)}px`,
    });
    layer.width = Math.max(1, Math.round(box.width * scale));
    layer.height = Math.max(1, Math.round(box.height * scale));
    context.setTransform(scale, 0, 0, scale, 0, 0);
    draw(context, box.width, box.height, current);
  };

  if (typeof ResizeObserver === "function")
    new ResizeObserver(paint).observe(screen);
  screen.ownerDocument.defaultView?.addEventListener("resize", paint);
  return {
    show(guide) {
      if (guide === current && guide !== null) return paint();
      current = guide;
      paint();
    },
  };
}
