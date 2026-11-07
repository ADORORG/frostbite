import { colour } from "./palette.ts";

// Writing on the screen: a small monospace type with a dark shadow so it reads on any colour. The screen is drawn at twice its size, so
// type is sharp even though the pictures are made of big pixels.
const font = '"Courier New", ui-monospace, monospace';

export function write(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  align: CanvasTextAlign = "center",
): void {
  context.font = `bold ${String(size)}px ${font}`;
  context.textAlign = align;
  context.textBaseline = "top";
  context.fillStyle = colour.deep;
  context.fillText(text, x + 0.5, y + 0.5);
  context.fillStyle = fill;
  context.fillText(text, x, y);
}

// Splits words into lines of at most `width` characters.
export function lines(text: string, width: number): readonly string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line.length > 0 && line.length + 1 + word.length > width) {
      out.push(line);
      line = word;
    } else line = line.length > 0 ? `${line} ${word}` : word;
  }
  if (line.length > 0) out.push(line);
  return out;
}
