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
}

export function surface() {
  const drawn: Drawn[] = [];
  const written: Written[] = [];
  // The page's origin and scale, as the maze moves and enlarges them; what is noted is where it lands on the screen.
  let place = { scale: 1, x: 0, y: 0 };
  const saved: (typeof place)[] = [];
  const context = {
    fillRect(x: number, y: number, width: number, height: number) {
      drawn.push({
        alpha: context.globalAlpha,
        fill: context.fillStyle,
        height: height * place.scale,
        width: width * place.scale,
        x: place.x + x * place.scale,
        y: place.y + y * place.scale,
      });
    },
    restore() {
      place = saved.pop() ?? place;
    },
    save() {
      saved.push(place);
    },
    scale(factor: number) {
      place = { ...place, scale: place.scale * factor };
    },
    translate(x: number, y: number) {
      place = {
        ...place,
        x: place.x + x * place.scale,
        y: place.y + y * place.scale,
      };
    },
    fillStyle: "",
    fillText(text: string) {
      written.push({
        align: context.textAlign,
        fill: context.fillStyle,
        text,
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
