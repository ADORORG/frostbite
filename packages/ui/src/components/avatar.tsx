import { avatarPattern } from "./avatar-pattern.ts";

// The picture for a wallet address (or any text): a mirrored pixel grid in one colour from the text, drawn inline so
// it needs no image, request or profile. It is decorative unless given a label.
export function Avatar({
  label,
  seed,
  size = 32,
}: {
  readonly label?: string;
  readonly seed: string;
  readonly size?: number;
}) {
  const { cells, hue } = avatarPattern(seed);
  return (
    <svg
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      className="avatar"
      height={size}
      role={label === undefined ? undefined : "img"}
      viewBox="0 0 5 5"
      width={size}
    >
      {cells.flatMap((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              fill={`hsl(${String(hue)} 85% 62%)`}
              height="1"
              key={`${String(x)}-${String(y)}`}
              width="1"
              x={x}
              y={y}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
