"use client";

import { gameTagLabels, gameTags, type GameTag } from "@ador/shared/games";
import {
  ArcadeActionButton,
  ArcadeTextField,
  ArcadeToggleTabs,
} from "@repo/ui/arcade";
import type { Ref } from "react";

import type { PublicGame } from "../domain/catalog.ts";
import {
  emptyGameQuery,
  isEmptyQuery,
  queryTextLimit,
  tagsInOrder,
  type GameQuery,
} from "../domain/game-query.ts";
import { searchCopy } from "../domain/search-copy.ts";

const playableValue = "playable";

// The search box and the filters above the wall. It only reports what the person changed; the page owns the query.
export function GamesSearchBar({
  games,
  inputRef,
  onChange,
  query,
}: {
  readonly games: readonly PublicGame[];
  readonly inputRef: Ref<HTMLInputElement>;
  readonly onChange: (query: GameQuery) => void;
  readonly query: GameQuery;
}) {
  // Only kinds some game has: a filter that can never show anything is noise.
  const kinds = gameTags.filter((tag) =>
    games.some((game) => game.tags.includes(tag)),
  );
  return (
    <form
      className="arcade-search"
      onKeyDown={(event) => {
        // Escape empties the box; on an empty box it leaves it.
        if (
          event.key !== "Escape" ||
          !(event.target instanceof HTMLInputElement)
        )
          return;
        event.preventDefault();
        if (query.text === "") event.target.blur();
        else onChange({ ...query, text: "" });
      }}
      onSubmit={(event) => event.preventDefault()}
      role="search"
    >
      <ArcadeTextField
        autoComplete="off"
        hint={searchCopy.fieldHint}
        inputRef={inputRef}
        label={searchCopy.fieldLabel}
        maxLength={queryTextLimit}
        onChange={(text) => onChange({ ...query, text })}
        type="search"
        value={query.text}
      />
      <ArcadeToggleTabs<GameTag>
        label={searchCopy.kinds}
        onChange={(tag, on) =>
          onChange({
            ...query,
            tags: tagsInOrder(
              new Set(
                on
                  ? [...query.tags, tag]
                  : query.tags.filter((each) => each !== tag),
              ),
            ),
          })
        }
        options={kinds.map((tag) => ({
          count: games.filter((game) => game.tags.includes(tag)).length,
          label: gameTagLabels[tag],
          value: tag,
        }))}
        selected={query.tags}
      />
      <ArcadeToggleTabs<typeof playableValue>
        label={searchCopy.show}
        onChange={(_, on) => onChange({ ...query, playable: on })}
        options={[
          {
            count: games.filter(({ playable }) => playable).length,
            label: searchCopy.playableOnly,
            value: playableValue,
          },
        ]}
        selected={query.playable ? [playableValue] : []}
      />
      {isEmptyQuery(query) ? null : (
        <ArcadeActionButton
          onClick={() => onChange(emptyGameQuery)}
          size="small"
        >
          {searchCopy.clearAll}
        </ArcadeActionButton>
      )}
    </form>
  );
}
