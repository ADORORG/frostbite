import { z } from "zod";

// The longest description of a cover picture (for a person who cannot see it).
export const gameCoverAltLimit = 200;

// How a game is reached and shown: where it lives (an origin and a base path), the picture the catalog shows for it, and the
// two ways a player gets to it. Split from the manifest, which lists what a game declares about itself.

export const webUrlSchema = z.url({ protocol: /^https?$/u });

// A host with no path, query or fragment: `https://play.example.com` or `https://example.com:8443`. Where a
// game lives under that host is its base path, so the two cannot be confused or smuggle a query.
export const gameOriginSchema = webUrlSchema.refine(
  // A value that is not a URL at all has already failed the check above, and must not throw here.
  (value) => URL.canParse(value) && new URL(value).origin === value,
  {
    message:
      "Give the address of the host only, with no path or trailing slash.",
  },
);

// Where a game lives under its host: nothing (the game has the whole host, the default way), or one or more
// safe path segments (`/play/frostbite`) for a game served from a path of the platform's own domain. No
// trailing slash, no empty, `.` or `..` segment.
export const gameBasePathSchema = z
  .string()
  .max(128)
  .regex(/^(?:\/[a-z0-9]+(?:[._~-][a-z0-9]+)*)*$/u);

// A cover is a picture, and optionally a short silent clip, that the catalog shows as the game's preview. Each
// is the name of one file in the game's `assets` folder, so it is published with the game, served from the
// platform's own address, and cannot name another folder or another site.
const coverImagePattern =
  /^[a-z0-9][a-z0-9._-]{0,63}\.(?:avif|jpg|png|svg|webp)$/u;
const coverVideoPattern = /^[a-z0-9][a-z0-9._-]{0,63}\.(?:mp4|webm)$/u;
export const gameCoverSchema = z
  .object({
    // What the picture shows, for a person who cannot see it.
    alt: z.string().trim().min(1).max(gameCoverAltLimit),
    image: z.string().regex(coverImagePattern),
    video: z.string().regex(coverVideoPattern).nullable(),
  })
  .strict();

// Where the platform serves the files of the games it plays itself, one folder per game identifier.
export const embeddedGameRoot = "/play";
// The page of a game, named in full: the platform's static files have no directory index, and the game's
// own files are addressed relative to this page.
export const embeddedGamePath = (id: string) =>
  `${embeddedGameRoot}/${id}/index.html`;
// A file of the game's `assets` folder, as the platform serves it.
export const embeddedGameAssetPath = (id: string, file: string) =>
  `${embeddedGameRoot}/${id}/assets/${file}`;

// How a player reaches the game. `external`: the game runs on its own address, which is the host (`url`) plus
// its base path. A null host means the game is registered but has no play address configured, and is shown
// as not playable. `returnUrl` is where the game sends the player back to; null means the platform's own page
// for the game. `embedded`: the game is a reviewed, client-only build the platform serves from its own
// domain and shows in an isolated frame; it needs no settings, because its address is its identifier.
export const gameLaunchSchema = z.discriminatedUnion("mode", [
  z
    .object({
      basePath: gameBasePathSchema,
      mode: z.literal("external"),
      returnUrl: webUrlSchema.nullable(),
      url: gameOriginSchema.nullable(),
    })
    .strict(),
  z.object({ mode: z.literal("embedded") }).strict(),
]);
