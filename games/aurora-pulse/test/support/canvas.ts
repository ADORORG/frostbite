// A drawing surface that notes what is drawn on it, for the tests of the screen.
export interface Drawn {
  readonly alpha: number;
  readonly fill: string;
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface Written {
  readonly align: string;
  readonly fill: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

export function surface() {
  const drawn: Drawn[] = [];
  const written: Written[] = [];
  const context = {
    fillRect(x: number, y: number, width: number, height: number) {
      drawn.push({
        alpha: context.globalAlpha,
        fill: context.fillStyle,
        height,
        width,
        x,
        y,
      });
    },
    fillStyle: "",
    fillText(text: string, x: number, y: number) {
      written.push({
        align: context.textAlign,
        fill: context.fillStyle,
        text,
        x,
        y,
      });
    },
    font: "",
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    setTransform: () => undefined,
    textAlign: "left",
    textBaseline: "alphabetic",
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    drawn,
    state: context,
    written,
  };
}

export const ofColour = (
  list: readonly Drawn[],
  fill: string,
): readonly Drawn[] => list.filter((block) => block.fill === fill);
