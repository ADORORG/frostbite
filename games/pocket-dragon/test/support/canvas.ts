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
  const transforms: number[][] = [];
  const context = {
    // A gradient is noted by name: its colours are in `stops`.
    createLinearGradient: () => ({
      addColorStop: (_at: number, fill: string) => void stops.push(fill),
      toString: () => "gradient",
    }),
    fillRect(x: number, y: number, width: number, height: number) {
      drawn.push({ fill: String(context.fillStyle), height, width, x, y });
    },
    fillStyle: "" as string | object,
    fillText(text: string, x: number, y: number) {
      written.push({ fill: String(context.fillStyle), text, x, y });
    },
    font: "",
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    setTransform: (...values: number[]) => void transforms.push(values),
    textAlign: "",
    textBaseline: "",
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    drawn,
    stops,
    texts: () => written.map(({ text }) => text),
    transforms,
    written,
  };
}
