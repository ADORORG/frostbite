import { ImageResponse } from "next/og";

// The colours of the arcade (`packages/ui/src/tokens.css`) as plain values: a picture is drawn outside the page's stylesheet, so it
// cannot read custom properties. `share-card.unit.test.ts` fails when one drifts from the stylesheet.
export const shareCardColors = {
  background: "#0b0520",
  border: "#3a2870",
  muted: "#b9aaec",
  surface: "#1b1046",
  text: "#ede7ff",
  accent: "#2be7ff",
  highlight: "#ffd23f",
} as const;

export const shareCardSize = { height: 630, width: 1200 } as const;

export interface ShareCard {
  readonly kicker: string;
  // A picture to show beside the words, as a data address, or none.
  readonly picture: string | null;
  readonly subtitle: string;
  readonly title: string;
}

// The longest the title may be before it is cut, so a long name cannot push the rest off the card.
const titleLimit = 60;
const subtitleLimit = 140;

function cut(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

// A 1200 by 630 picture of a page for a link preview: the site's name, the title, a line of description, and the page's own picture.
export function shareCardResponse(
  card: ShareCard,
  cacheControl: string,
): ImageResponse {
  const { accent, background, border, highlight, muted, surface, text } =
    shareCardColors;
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background,
        border: `12px solid ${border}`,
        color: text,
        display: "flex",
        height: "100%",
        padding: "56px",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: "24px",
          paddingRight: card.picture === null ? "0" : "40px",
        }}
      >
        <div
          style={{
            color: highlight,
            fontSize: 32,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          {card.kicker}
        </div>
        <div
          style={{
            color: text,
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          {cut(card.title, titleLimit)}
        </div>
        <div style={{ color: muted, fontSize: 34, lineHeight: 1.3 }}>
          {cut(card.subtitle, subtitleLimit)}
        </div>
      </div>
      {card.picture === null ? null : (
        <div
          style={{
            alignItems: "center",
            background: surface,
            border: `6px solid ${accent}`,
            display: "flex",
            height: 440,
            justifyContent: "center",
            overflow: "hidden",
            width: 440,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- drawn by the image renderer, not shown in a page */}
          <img alt="" height={428} src={card.picture} width={428} />
        </div>
      )}
    </div>,
    { ...shareCardSize, headers: { "Cache-Control": cacheControl } },
  );
}
