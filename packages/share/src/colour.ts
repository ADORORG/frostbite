// Whether text on a colour should be dark or light, by the colour's relative luminance (WCAG 2.x), so a bright tile (a green, a yellow) is not
// given white text it cannot be read with.
export function readableOn(hex: string): "dark" | "light" {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.4 ? "dark" : "light";
}
