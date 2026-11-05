import { GameHostError, type GameClient } from "@ador/game-sdk/client";
import { pauseCopy, type Pause } from "@ador/game-sdk/pause";
import type { PlatformPlay } from "@ador/game-sdk/play";
import type { RunRecord } from "@ador/game-sdk/run-record";
import { submitNote, type SubmitState } from "@ador/game-sdk/run-notes";

// Sends a finished run's record to the platform (if a run was issued and the platform answered), and tells, through `say`, what became of it: the
// run is only its own claim when it could not be sent, pending while it is, and what the platform made of it when it comes back.
export async function submitRun(
  play: PlatformPlay | null,
  runId: string | null,
  record: RunRecord,
  say: (text: string) => void,
): Promise<void> {
  if (runId === null || play === null) {
    say(submitNote(null));
    return;
  }
  say(submitNote({ kind: "pending" }));
  const settled: SubmitState = await play.runs.submit(runId, record).then(
    (result) => ({ kind: "settled", result }) as const,
    () => ({ kind: "failed" }) as const,
  );
  say(submitNote(settled));
}

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
