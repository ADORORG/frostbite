// The platform's mark: a pixel snowflake, drawn from rows of text the way the scenes draw their art ("#" is an arm, "o" the bright core).
const rows = [
  "....#....",
  ".#..#..#.",
  "..#.#.#..",
  "...ooo...",
  "####o####",
  "...ooo...",
  "..#.#.#..",
  ".#..#..#.",
  "....#....",
] as const;

export function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      className="app-brand__mark"
      focusable="false"
      shapeRendering="crispEdges"
      viewBox="0 0 9 9"
    >
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "." ? null : (
            <rect
              className={cell === "o" ? "brand-mark__core" : "brand-mark__arm"}
              height="1"
              key={`${String(x)}-${String(y)}`}
              width="1"
              x={x}
              y={y}
            />
          ),
        ),
      )}
    </svg>
  );
}
