import { surface } from "./canvas.ts";

// A frame drawn on a noting surface, the blocks of one colour in it, and whether every block of some frames is drawn in a colour with
// whole, finite sums.
type Draw<State> = (context: CanvasRenderingContext2D, state: State) => void;

export function drawnWith<State>(draw: Draw<State>, state: State) {
  const screen = surface();
  draw(screen.context, state);
  return screen;
}

export const count = <State>(
  draw: Draw<State>,
  state: State,
  fill: string,
): number =>
  drawnWith(draw, state).drawn.filter((block) => block.fill === fill).length;

export const sound = <State>(
  draw: Draw<State>,
  states: readonly State[],
): boolean =>
  states.every((state) =>
    drawnWith(draw, state).drawn.every(
      (block) =>
        /^(#[0-9a-f]{3,8}|rgb\(.+\)|gradient)$/iu.test(block.fill) &&
        [block.x, block.y, block.width, block.height].every(Number.isFinite),
    ),
  );
