// The response headers for a game's files. They are the second half of the isolation, beside the sandbox
// attribute on the frame: they hold when the files are opened outside the frame, and they remove from the game
// everything it has no use for. `sandbox` without `allow-same-origin` gives the page an opaque origin, so it
// cannot read the platform's cookies, storage or pages; `connect-src 'none'` is what stops it calling any
// address; scripts and styles come only from the game's own files.
export const gameContentSecurityPolicy = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  // Only the platform's own pages may show the game in a frame.
  "frame-ancestors 'self'",
].join("; ");

export interface HeaderEntry {
  readonly key: string;
  readonly value: string;
}

export function gameResponseHeaders(): HeaderEntry[] {
  return [
    { key: "Content-Security-Policy", value: gameContentSecurityPolicy },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // The frame's page is a different origin from the files' own, so a font (fetched with CORS) is refused
    // unless the files say anyone may read them. They are public, static and carry no credentials.
    { key: "Access-Control-Allow-Origin", value: "*" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Cache-Control", value: "no-cache" },
  ];
}
