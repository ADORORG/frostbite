import { gameId } from "../rules/constants.ts";

// The address that invites a friend: the platform's own page for the game. The game is never told the platform's address, but the page
// that frames it is its referrer, and on the platform that is the game's page (`/games/<id>`). Anywhere else (a test page, a preview)
// there is no address to give, and the card asks friends to look for the game in the arcade instead.
export const gamePath = `/games/${gameId}`;

export function inviteFrom(referrer: string): string | null {
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return null;
  }
  const web = url.protocol === "https:" || url.protocol === "http:";
  return web && url.pathname.replace(/\/+$/u, "") === gamePath
    ? `${url.origin}${gamePath}`
    : null;
}
