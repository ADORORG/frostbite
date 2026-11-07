import type { PlayId } from "../rules/constants.ts";
import { startQuestRun } from "./quest-run.ts";
import { startRun, type PlayRun } from "./runs.ts";

// Starting what is played: the whole quest or a level alone, as a run that counts or (in the admin's test mode) a test run.
export const startPlay = (
  id: PlayId,
  seed: number,
  onEarned?: (milestone: string) => void,
  test = false,
): PlayRun =>
  id === "quest"
    ? startQuestRun(seed, onEarned, test)
    : startRun(id, seed, onEarned, test);

// What the quest's (and each level's) screen shows before a run: its start, just after the opening banner, with the counts of a run not
// yet begun (the quest's clock at nothing). It is never played and never recorded, and made once for each.
export const idleTicks = 150;

export function createIdleRuns(): (id: PlayId) => PlayRun {
  const idle = new Map<PlayId, PlayRun>();
  return (id) => {
    const found = idle.get(id);
    if (found !== undefined) return found;
    const made = startPlay(id, 1);
    const counts = made.stats();
    for (let at = 0; at < idleTicks; at += 1) made.tick();
    const shown: PlayRun = { ...made, stats: () => counts };
    idle.set(id, shown);
    return shown;
  };
}
