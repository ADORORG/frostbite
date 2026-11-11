"use client";

import type { ShareConfig } from "@frostbite/share";
import type { CreateShareInput } from "@frostbite/shared/games";
import { useMemo } from "react";

import type { SharesApi } from "../client/shares-api.ts";
import { shareCopy } from "../domain/share-copy.ts";
import { groupedNumber } from "../domain/shared-model.ts";
import { ShareControl } from "./share-control.tsx";

// Sharing the player's new best score, as a small chip in the game's top bar: outside the picture, never over the play area, and there only
// once a run has beaten the best. The score is the one the game saved; the page says it is self-reported.
export function ScoreShare({
  api,
  config,
  gameId,
  gameTitle,
  score,
}: {
  readonly api?: SharesApi | undefined;
  readonly config: ShareConfig;
  readonly gameId: string;
  readonly gameTitle: string;
  readonly score: number;
}) {
  const request = useMemo<CreateShareInput>(
    () => ({ gameId, kind: "score", score }),
    [gameId, score],
  );
  return (
    <ShareControl
      api={api}
      config={config}
      heading={groupedNumber(score)}
      kicker={shareCopy.page.newBest(gameTitle)}
      request={request}
      text={shareCopy.post.score(groupedNumber(score), gameTitle)}
      variant="chip"
    />
  );
}

// Sharing one milestone the player holds, as a small chip on its card in the game's milestone list.
export function MilestoneShare({
  api,
  config,
  gameId,
  gameTitle,
  milestoneId,
  title,
}: {
  readonly api?: SharesApi | undefined;
  readonly config: ShareConfig;
  readonly gameId: string;
  readonly gameTitle: string;
  readonly milestoneId: string;
  readonly title: string;
}) {
  const request = useMemo<CreateShareInput>(
    () => ({ gameId, kind: "milestone", milestoneId }),
    [gameId, milestoneId],
  );
  return (
    <ShareControl
      api={api}
      config={config}
      heading={title}
      kicker={gameTitle}
      request={request}
      text={shareCopy.post.milestone(title, gameTitle)}
      variant="chip"
    />
  );
}
