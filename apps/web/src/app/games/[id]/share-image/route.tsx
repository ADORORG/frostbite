import { gameIdSchema } from "@frostbite/shared/games";

import { games } from "@repo/configs/games";
import { pageImageCacheControl } from "@/server/metadata/cache";
import { readGameCover } from "@/server/metadata/game-cover";
import { shareCardResponse } from "@/server/metadata/share-card";

// The picture a link preview shows for a game: its title and summary beside its cover. An identifier that is not a registered game has
// no picture, so the address reveals nothing about what is not listed.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = gameIdSchema.safeParse(id);
  const game = parsed.success
    ? games.find((candidate) => candidate.id === parsed.data)
    : undefined;
  if (game === undefined) return new Response(null, { status: 404 });
  return shareCardResponse(
    {
      kicker: "Game",
      picture:
        game.cover === undefined
          ? null
          : await readGameCover(game.id, game.cover.image),
      subtitle: game.summary,
      title: game.title,
    },
    pageImageCacheControl,
  );
}
