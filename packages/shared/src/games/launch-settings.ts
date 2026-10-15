import { z } from "zod";

import {
  gameBasePathSchema,
  gameOriginSchema,
  webUrlSchema,
} from "./launch.ts";
import { gameIdSchema, type GameManifest } from "./manifest.ts";
import { chainRefTextSchema } from "../chain/chain-ref.ts";

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
