import type { CSSProperties } from "react";

// How hot something is, in the arcade's own language: a row of rising bars like a signal or a power meter, lit from the left up to the
// level, in an ember gradient. It is one picture with one name (`label`), so a screen reader hears "Blazing, 5 of 5" once and not five bars.
// The words stay with the feature; the drawing lives here once.
export function HeatMeter({
  description,
  label,
  level,
  levels,
}: {
  // What the meter says to someone who cannot see it (the stage and the level, in words).
  readonly description: string;
  // The word written beside the bars.
  readonly label: string;
  readonly level: number;
  readonly levels: number;
}) {
  return (
    <span className="heat">
      <span aria-label={description} className="heat__meter" role="img">
        {Array.from({ length: levels }, (_, index) => (
          <i
            data-lit={index < level ? "true" : undefined}
            key={index}
            style={{ "--heat-step": index } as CSSProperties}
          />
        ))}
      </span>
      <span aria-hidden="true" className="heat__word">
        {label}
      </span>
    </span>
  );
}

// The sticker on a hot game's picture: a pixel flame that flickers (and stands still for a person who asked for less motion) and a word.
export function HotSticker({ children }: { readonly children: string }) {
  return (
    <span className="hot-sticker">
      <svg aria-hidden="true" className="hot-sticker__flame" viewBox="0 0 8 10">
        <path d="M4 0 5 2 6 3 7 5 7 8 6 9 5 10 3 10 2 9 1 8 1 6 2 4 3 5 3 3 4 0Z" />
      </svg>
      {children}
    </span>
  );
}
