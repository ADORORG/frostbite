import { cardKicker, sharedView } from "@frostbite/feature-games/shared-view";
import { sharesResolverFor } from "@frostbite/feature-games/shares-runtime";
import { shareIdSchema } from "@frostbite/shared/games";

import { games } from "@repo/configs/games";
import { pageImageCacheControl } from "@/server/metadata/cache";
import { readGameCover } from "@/server/metadata/game-cover";
import { shareCardResponse } from "@/server/metadata/share-card";

export const runtime = "nodejs";

// The picture a link preview shows for something a player shared: what it is, the game's cover when it has one, and how the platform
// knows it. A link that is ended, never was, or is not an identifier has no picture, so the address reveals nothing. The card carries
// nothing about who shared it.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = shareIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const thing = await (await sharesResolverFor(games)()).get(parsed.data);
  const view = thing === null ? null : sharedView(thing, games);
  if (view === null) return new Response(null, { status: 404 });
  return shareCardResponse(
    {
      kicker: cardKicker(view),
      picture:
        view.cover === null || view.gameId === null
          ? null
          : await readGameCover(view.gameId, view.cover.image),
      subtitle: view.subtitle,
      title: view.title,
    },
    pageImageCacheControl,
  );
}
