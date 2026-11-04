import { gameTags, gameTagSchema, type GameTag } from "@ador/shared/games";

// What a person asked the games page for: words to look for, kinds of game, and whether only playable ones. It lives in the address
// (`?q=snow&tag=puzzle&playable=1`) so a result can be shared and survives a reload. This module is the
// one place that reads and writes that address, on the server and in the browser alike.

// A search is a few words, not a document: past this the rest is dropped, so an address cannot make the page work on a book.
export const queryTextLimit = 64;

export interface GameQuery {
  // Only games that can be opened.
  readonly playable: boolean;
  // Games with any of these tags (a person ticking Puzzle and Arcade wants either, not only both).
  readonly tags: readonly GameTag[];
  readonly text: string;
}

export const emptyGameQuery: GameQuery = Object.freeze({
  playable: false,
  tags: [],
  text: "",
});

// The kinds in the platform's order, whatever order they were chosen in, so one choice is always one address.
export const tagsInOrder = (wanted: ReadonlySet<GameTag>): GameTag[] =>
  gameTags.filter((tag) => wanted.has(tag));

// Spaces alone are no text, so a box holding only spaces asks for nothing.
export const isEmptyQuery = ({ playable, tags, text }: GameQuery): boolean =>
  !playable && tags.length === 0 && text.trim() === "";

// The address's query string as the framework hands it to a page: one value, several, or none per name.
export type RawQuery = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export function searchParamsOf(raw: RawQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(raw))
    for (const each of typeof value === "string" ? [value] : (value ?? []))
      params.append(name, each);
  return params;
}

// Reads an address, trusting none of it: text is trimmed, spaces collapsed and cut to the limit, a tag that is not on the platform's
// list is dropped, and anything else in the address is ignored. The same address always gives the same query.
export function parseGameQuery(params: URLSearchParams): GameQuery {
  const asked = new Set<GameTag>();
  for (const value of params.getAll("tag")) {
    const tag = gameTagSchema.safeParse(value);
    if (tag.success) asked.add(tag.data);
  }
  return {
    playable: params.get("playable") === "1",
    tags: tagsInOrder(asked),
    // Cut by characters, not by the UTF-16 units `slice` counts, so a picture or an accented letter is never split in half.
    text: Array.from((params.get("q") ?? "").replace(/\s+/gu, " ").trim())
      .slice(0, queryTextLimit)
      .join("")
      .trim(),
  };
}

// The address for a query, without the leading `?`; empty for the empty query, so the plain page keeps its plain address.
export function gameQueryString(query: GameQuery): string {
  const params = new URLSearchParams();
  if (query.text.trim() !== "") params.set("q", query.text);
  for (const tag of query.tags) params.append("tag", tag);
  if (query.playable) params.set("playable", "1");
  return params.toString();
}
