// A context that remembers each piece of text (with the size and colour it was written in) and each fill.
export function recorder() {
  const texts: {
    fill: string;
    size: number;
    text: string;
    x: number;
    y: number;
  }[] = [];
  const fills: {
    alpha: number;
    fill: string;
    height: number;
    width: number;
  }[] = [];
  const state = { alpha: 1, fill: "", font: "" };
  const context = {
    fillRect: (_x: number, _y: number, width: number, height: number) =>
      void fills.push({ alpha: state.alpha, fill: state.fill, height, width }),
    fillText: (text: string, x: number, y: number) =>
      void texts.push({
        fill: state.fill,
        size: Number(/(\d+(?:\.\d+)?)px/u.exec(state.font)?.[1]),
        text,
        x,
        y,
      }),
    get fillStyle() {
      return state.fill;
    },
    set fillStyle(value: string) {
      state.fill = value;
    },
    get font() {
      return state.font;
    },
    set font(value: string) {
      state.font = value;
    },
    get globalAlpha() {
      return state.alpha;
    },
    set globalAlpha(value: number) {
      state.alpha = value;
    },
    textAlign: "",
    textBaseline: "",
  } as unknown as CanvasRenderingContext2D;
  return { context, fills, texts };
}
