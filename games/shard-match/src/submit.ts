import { GameHostError, type GameClient } from "@frostbite/game-sdk/client";
import { pauseCopy, type Pause } from "@frostbite/game-sdk/pause";

// What the page says when it could not connect (the platform's own reason if it gave one), and that the game can still be played.
export const refusalNote = (error: unknown): string =>
  error instanceof GameHostError
    ? `The platform said: ${error.code}`
    : "Could not connect to the platform. You can still play.";

// The titles of the game's milestones by id, as the platform has them (none if it cannot say).
export async function loadTitles(
  client: GameClient,
): Promise<Map<string, string>> {
  const listed = await client.milestones.list().catch(() => []);
  return new Map(listed.map(({ id, title }) => [id, title]));
}

// Keeps the pause button's words and the note in step with the pause: "Resume" and the pause note while paused, and the note as it was after.
export function followPause(
  pause: Pause,
  button: HTMLElement,
  note: HTMLElement,
): void {
  let held = "";
  pause.subscribe((paused) => {
    button.textContent = paused ? pauseCopy.resume : pauseCopy.pause;
    if (paused) {
      held = note.textContent;
      note.textContent = pauseCopy.paused;
    } else note.textContent = held;
  });
}
