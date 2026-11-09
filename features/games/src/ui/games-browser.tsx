"use client";

import type { GameHeat } from "@frostbite/shared/games";
import { ArcadeActionButton, ArcadeEmptyState } from "@repo/ui/arcade";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import type { PublicGame } from "../domain/catalog.ts";
import {
  emptyGameQuery,
  gameQueryString,
  isEmptyQuery,
  type GameQuery,
} from "../domain/game-query.ts";
import { hotFirst } from "../domain/heat-order.ts";
import {
  countText,
  foundText,
  noMatch,
  searchCopy,
  searchShortcutKey,
} from "../domain/search-copy.ts";
import { searchGames } from "../domain/search-games.ts";
import { GamesSearchBar } from "./games-search-bar.tsx";
import { GamesWall } from "./games-wall.tsx";

// Whether a key press is meant for a field the person is already typing in.
const typingInField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

// The query goes into the address as it changes, replacing the entry rather than adding one, so a shared link, a reload and a return to
// the page all show the same games without a long trail of back-button steps for every letter typed.
function writeAddress(query: GameQuery): void {
  const text = gameQueryString(query);
  const { hash, pathname } = window.location;
  window.history.replaceState(
    window.history.state,
    "",
    `${pathname}${text === "" ? "" : `?${text}`}${hash}`,
  );
}

// The games page: a search box and filters over the wall of covers. The whole catalog is already here (a short list), so every keystroke
// answers at once with nothing to wait for. `initial` is the query the address carried, so a shared link opens already narrowed.
export function GamesBrowser({
  games: listed,
  hot = [],
  initial,
}: {
  readonly games: readonly PublicGame[];
  // The ranked games; the wall puts them first.
  readonly hot?: readonly GameHeat[];
  readonly initial: GameQuery;
}) {
  const games = useMemo(() => hotFirst(listed, hot), [listed, hot]);
  const [query, setQuery] = useState(initial);
  // The server sends a new `initial` each time it draws the page afresh (a link pressed while narrowed, a refresh): that query came from
  // the address now showing, so it replaces what is on the screen. The page's own typing never reaches the server, so it is never undone.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setQuery(initial);
  }
  const input = useRef<HTMLInputElement>(null);
  // Typing stays instant; the wall catches up when the page has a moment, so a slow phone never stutters on a letter.
  const settled = useDeferredValue(query);
  const found = useMemo(() => searchGames(games, settled), [games, settled]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== searchShortcutKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.defaultPrevented ||
        typingInField(event.target)
      )
        return;
      event.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const change = (next: GameQuery) => {
    setQuery(next);
    writeAddress(next);
  };
  const narrowed = !isEmptyQuery(settled);
  const missing = noMatch(settled.text);

  return (
    <>
      <header className="arcade-wall-head">
        <h2>
          Games <span>{countText(found.length, games.length)}</span>
        </h2>
      </header>
      <GamesSearchBar
        games={games}
        inputRef={input}
        onChange={change}
        query={query}
      />
      <p aria-live="polite" className="arcade-visually-hidden" role="status">
        {narrowed ? foundText(found.length) : ""}
      </p>
      {found.length === 0 ? (
        <ArcadeEmptyState
          action={
            <ArcadeActionButton onClick={() => change(emptyGameQuery)}>
              {searchCopy.clearAll}
            </ArcadeActionButton>
          }
          title={missing.title}
        >
          {missing.body}
        </ArcadeEmptyState>
      ) : (
        <GamesWall games={found} hot={hot} whole={!narrowed} />
      )}
    </>
  );
}
