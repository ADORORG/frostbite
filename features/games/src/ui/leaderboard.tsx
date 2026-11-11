"use client";

import {
  leaderboardWindows,
  type GetLeaderboardResponse,
  type LeaderboardWindow,
} from "@frostbite/shared/games";
import { profilePath } from "@frostbite/shared/profiles";
import { ProfileAvatar, StatusLamp } from "@repo/ui/arcade";
import { useState } from "react";

import type { LeaderboardApi } from "../client/leaderboard-api.ts";
import { leaderboardCopy as copy } from "../domain/leaderboard-copy.ts";
import { useLeaderboard } from "./use-leaderboard.ts";

type Entry = GetLeaderboardResponse["entries"][number];

const hoursUntil = (end: string, now: number) =>
  Math.max(0, Math.ceil((Date.parse(end) - now) / 3_600_000));

function Who({ entry }: { readonly entry: Entry }) {
  if (entry.profile === null)
    return <span className="board-who">{copy.anonymous}</span>;
  return (
    <a className="board-who" href={profilePath(entry.profile.name)}>
      <ProfileAvatar avatar={entry.profile.avatar} size={28} />
      {entry.profile.name}
    </a>
  );
}

// The first three places, drawn as a podium: the champion in the middle and highest.
function Podium({ entries }: { readonly entries: readonly Entry[] }) {
  return (
    <ol aria-label="Top three" className="board-podium">
      {entries.map((entry) => (
        <li
          className="board-podium__step"
          data-rank={entry.rank}
          key={`${entry.rank}-${entry.achievedAt}`}
        >
          <span className="board-podium__rank">{entry.rank}</span>
          <Who entry={entry} />
          <strong className="board-podium__score">
            {entry.score.toLocaleString("en-US")}
          </strong>
        </li>
      ))}
    </ol>
  );
}

// A game's leaderboard: the best verified scores for all time, this month or this week, 25 places, with the signed-in player's own place
// underneath. A name appears only for a player who switched their public profile on.
export function Leaderboard({
  api,
  gameId,
  now,
}: {
  readonly api?: LeaderboardApi;
  readonly gameId: string;
  // The moment "resets in" is counted from; given so a test can fix it.
  readonly now?: number;
}) {
  const [window, setWindow] = useState<LeaderboardWindow>("all");
  // Read once, when the board opens, so a render never reads the clock.
  const [since] = useState(() => now ?? Date.now());
  const state = useLeaderboard(gameId, window, api);
  const entries = state.kind === "ready" ? state.board.entries : [];
  const hours =
    state.kind === "ready" && state.board.endsAt !== null
      ? hoursUntil(state.board.endsAt, since)
      : null;
  return (
    <div className="board">
      <p className="board__intro">{copy.intro}</p>
      <div aria-label={copy.windowLabel} className="board__tabs" role="group">
        {leaderboardWindows.map((kind) => (
          <button
            aria-pressed={kind === window}
            className="board__tab"
            key={kind}
            onClick={() => setWindow(kind)}
            type="button"
          >
            {copy.windows[kind]}
          </button>
        ))}
      </div>
      {state.kind === "loading" ? (
        <StatusLamp label={copy.loading} tone="attention" />
      ) : state.kind === "failed" ? (
        <p role="alert">{copy.failed}</p>
      ) : (
        <>
          <p className="board__meta">
            <span>{copy.players(state.board.players)}</span>
            {hours === null ? null : (
              <span>{copy.resets(Math.floor(hours / 24), hours % 24)}</span>
            )}
          </p>
          {entries.length === 0 ? (
            <p>{copy.empty[window]}</p>
          ) : (
            <>
              <Podium entries={entries.slice(0, 3)} />
              {entries.length > 3 ? (
                <ol className="board__rows" start={4}>
                  {entries.slice(3).map((entry) => (
                    <li
                      className="board__row"
                      key={`${entry.rank}-${entry.achievedAt}`}
                    >
                      <span className="board__rank">{entry.rank}</span>
                      <Who entry={entry} />
                      <strong>{entry.score.toLocaleString("en-US")}</strong>
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          )}
          <p className="board__mine">
            {state.place === null
              ? copy.noPlace
              : copy.place(state.place.rank, state.place.score)}
          </p>
        </>
      )}
    </div>
  );
}
