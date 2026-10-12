import { z } from "zod";

import { chainRefTextSchema } from "../chain/chain-ref.ts";
import { requestFingerprint } from "../http/fingerprint.ts";

// The limits on what a game declares about itself. They bound what a public page must render.
export const gameManifestLimits = Object.freeze({
  capabilities: 16,
  coverAlt: 200,
  description: 2_000,
  milestoneCriteria: 500,
  milestoneDescription: 500,
  milestoneTitle: 80,
  milestones: 64,
  summary: 200,
  title: 80,
  version: 32,
});

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

// The URL form of a game's identifier: lower-case words joined by hyphens. Stable for the life of the game,
// because it is in the page address and in every record that refers to the game.
export const gameIdSchema = z.string().min(2).max(64).regex(slugPattern);

// What a game may ask the host for (plan 8.7). A capability a game does not declare is never granted. The
// host protocol that enforces them is a later task; until then they are declarations only.
export const gameCapabilities = [
  "balance:read",
  "run:submit",
  "transaction:request",
  "wallet",
] as const;
export const gameCapabilitySchema = z.enum(gameCapabilities);

export const gameMilestoneClaimPolicies = ["once", "repeatable"] as const;

// A milestone a game says a player can earn, as data. Declaring one does not make it claimable: earning and
// claiming on chain need the attestation service and contract (ADR-018), which do not exist yet. A change to
// what a milestone means is a new manifest version, never an edit.
export const gameMilestoneSchema = z
  .object({
    claimPolicy: z.enum(gameMilestoneClaimPolicies),
    criteria: z
      .string()
      .trim()
      .min(1)
      .max(gameManifestLimits.milestoneCriteria),
    description: z
      .string()
      .trim()
      .min(1)
      .max(gameManifestLimits.milestoneDescription),
    id: gameIdSchema,
    title: z.string().trim().min(1).max(gameManifestLimits.milestoneTitle),
  })
  .strict();

const webUrlSchema = z.url({ protocol: /^https?$/u });

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
    alt: z.string().trim().min(1).max(gameManifestLimits.coverAlt),
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

export const gameManifestSchemaVersion = 1;

export const gameManifestSchema = z
  .object({
    capabilities: z
      .array(gameCapabilitySchema)
      .max(gameManifestLimits.capabilities)
      .refine((list) => new Set(list).size === list.length, {
        message: "A capability may be declared only once.",
      }),
    // Only a game the platform serves can have one, because the files must come with the game.
    cover: gameCoverSchema.optional(),
    description: z.string().trim().max(gameManifestLimits.description),
    id: gameIdSchema,
    launch: gameLaunchSchema,
    milestones: z
      .array(gameMilestoneSchema)
      .max(gameManifestLimits.milestones)
      .refine(
        (list) => new Set(list.map(({ id }) => id)).size === list.length,
        { message: "A milestone id may appear only once in a game." },
      ),
    // The chain the game's own on-chain actions happen on.
    network: chainRefTextSchema,
    schemaVersion: z.literal(gameManifestSchemaVersion),
    summary: z.string().trim().min(1).max(gameManifestLimits.summary),
    title: z.string().trim().min(1).max(gameManifestLimits.title),
    // The game's own release version (any short text its team uses), separate from the manifest format.
    version: z.string().trim().min(1).max(gameManifestLimits.version),
  })
  .strict()
  .refine(
    ({ cover, launch }) => cover === undefined || launch.mode === "embedded",
    {
      message: "Only a game the platform plays itself can have a cover.",
      path: ["cover"],
    },
  );

export type GameCover = z.infer<typeof gameCoverSchema>;
export type GameManifest = z.infer<typeof gameManifestSchema>;
export type GameMilestone = z.infer<typeof gameMilestoneSchema>;
export type GameCapability = z.infer<typeof gameCapabilitySchema>;

// Checks a manifest and freezes it: what a game file exports, so a mistake fails when the platform starts,
// not when a player opens the page.
export function defineGame(manifest: GameManifest): Readonly<GameManifest> {
  return Object.freeze(gameManifestSchema.parse(manifest));
}

// The games the platform lists, in the order given. An identifier may appear once: it is the page address.
export function defineGames(
  games: readonly GameManifest[],
): readonly Readonly<GameManifest>[] {
  const defined = games.map(defineGame);
  const seen = new Set<string>();
  for (const { id } of defined) {
    if (seen.has(id)) throw new Error(`Game "${id}" is registered twice.`);
    seen.add(id);
  }
  return Object.freeze(defined);
}

// A stable digest of everything a manifest declares, independent of key order. It identifies the exact
// version of a game's declarations, so a milestone or a launch address cannot change under the same hash.
export function gameManifestHash(manifest: GameManifest): string {
  return requestFingerprint(gameManifestSchema.parse(manifest));
}

// The address a player is sent to, or null when the game has no host configured.
export function gamePlayAddress(launch: GameManifest["launch"]): string | null {
  return launch.mode === "embedded" || launch.url === null
    ? null
    : new URL(launch.basePath === "" ? "/" : launch.basePath, launch.url).href;
}

// What a deployment may set about a game, without editing its manifest: where it is served, where it sends
// the player back to, and which chain it uses there. Keyed by game identifier in the platform's configuration.
export const gameLaunchSettingsSchema = z
  .object({
    basePath: gameBasePathSchema.default(""),
    network: chainRefTextSchema.optional(),
    returnUrl: webUrlSchema.nullable().default(null),
    url: gameOriginSchema,
  })
  .strict();

export const gameLaunchSettingsMapSchema = z.record(
  gameIdSchema,
  gameLaunchSettingsSchema,
);

export type GameLaunchSettings = z.infer<typeof gameLaunchSettingsSchema>;

// The games with a deployment's launch settings applied. A setting for a game that is not registered is an
// error, so a misspelt identifier fails when the platform starts instead of leaving a game quietly unplayable.
export function applyGameLaunchSettings(
  games: readonly GameManifest[],
  settings: Readonly<Record<string, GameLaunchSettings>>,
): GameManifest[] {
  const known = new Set(games.map(({ id }) => id));
  for (const id of Object.keys(settings))
    if (!known.has(id))
      throw new Error(
        `Launch settings name a game that is not registered: "${id}".`,
      );
  return games.map((game) => {
    const setting = settings[game.id];
    if (setting !== undefined && game.launch.mode === "embedded")
      throw new Error(
        `Launch settings name "${game.id}", which the platform plays itself and which has no address to set.`,
      );
    return setting === undefined
      ? game
      : {
          ...game,
          launch: {
            basePath: setting.basePath,
            mode: "external",
            returnUrl: setting.returnUrl,
            url: setting.url,
          },
          network: setting.network ?? game.network,
        };
  });
}
