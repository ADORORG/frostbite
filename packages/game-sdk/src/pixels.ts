// What a small pixel-art screen is drawn with: a block of one colour on a grid of whole pixels, and a picture written as rows of text,
// one character a pixel. The screen is drawn small and scaled up by the page, crisp.
export function block(
  context: CanvasRenderingContext2D,
  fill: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.fillStyle = fill;
  context.fillRect(Math.round(x), Math.round(y), width, height);
}

// A picture of rows of text: each character names a colour in `key`, and a `.` (or any character the key does not name) is clear.
export function sprite(
  context: CanvasRenderingContext2D,
  rows: readonly string[],
  key: Readonly<Record<string, string>>,
  x: number,
  y: number,
): void {
  rows.forEach((row, line) => {
    [...row].forEach((cell, column) => {
      const fill = key[cell];
      if (fill !== undefined) block(context, fill, x + column, y + line, 1, 1);
    });
  });
}

// Wraps a position into [0, size), the way a scrolling layer comes round again.
export const wrap = (value: number, size: number): number =>
  ((Math.round(value) % size) + size) % size;
