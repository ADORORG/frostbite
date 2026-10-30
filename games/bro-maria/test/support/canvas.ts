// A drawing surface that notes what is drawn on it, for the tests of the screen.
export interface Drawn {
  readonly fill: string;
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface Written {
  readonly fill: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

export function surface() {
  const drawn: Drawn[] = [];
  const written: Written[] = [];
  const stops: string[] = [];
  const context = {
    createLinearGradient: () => ({
      addColorStop: (_at: number, fill: string) => void stops.push(fill),
    }),
    fillRect(x: number, y: number, width: number, height: number) {
      drawn.push({ fill: String(context.fillStyle), height, width, x, y });
    },
    fillStyle: "" as string | object,
    fillText(text: string, x: number, y: number) {
      written.push({ fill: String(context.fillStyle), text, x, y });
    },
    font: "",
    textAlign: "",
    textBaseline: "",
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    drawn,
    stops,
    written,
  };
}

export const ofColour = (
  list: readonly Drawn[],
  fill: string,
): readonly Drawn[] => list.filter((block) => block.fill === fill);
