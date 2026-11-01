import type { RunInput } from "@ador/game-sdk/run-record";

import {
  createQuestSession,
  type QuestSession,
} from "../../src/quest-session.ts";
import type { ChapterId } from "../../src/rules/constants.ts";
import { questDone } from "../../src/rules/quest/tick.ts";
import { playCastle } from "./castle-bot.ts";
import { playHills } from "./hills-bot.ts";
import { walkWoods } from "./woods-bot.ts";

// A player of the whole quest: each level is played by that level's own bot (the quest plays a level exactly as it is played alone, on
// the same seed), its presses made on the quest's clock from the tick the level began; then the quest is played on through the shift.
const plans: Readonly<
  Record<ChapterId, (seed: number) => readonly RunInput[]>
> = {
  castle: (seed) => playCastle(seed).inputs,
  hills: (seed) => playHills(seed).inputs,
  woods: (seed) => walkWoods(seed, { hurry: true }).inputs,
};

// A press or let-go of a level's record, with the tick it was made on (null for its end).
export function change(input: RunInput): { on: boolean; tick: number } | null {
  const data = input.data;
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return null;
  const on = "on" in data ? data.on : null;
  const tick = "tick" in data ? data.tick : null;
  return typeof tick === "number" && (on === 0 || on === 1)
    ? { on: on === 1, tick }
    : null;
}

// Plays the level the quest is in with its bot, then on until that level is over (cleared and shifted, or the quest done).
export function playLeg(session: QuestSession, seed: number): void {
  const leg = session.state().leg.id;
  const began = session.state().tick;
  for (const input of plans[leg](seed)) {
    const made = change(input);
    if (made === null) continue;
    while (session.state().tick < began + made.tick) session.tick();
    session.hold(input.type, made.on);
  }
  while (!questDone(session.state()) && session.state().leg.id === leg)
    session.tick();
}

export function playQuest(seed: number, levels = 3): QuestSession {
  const session = createQuestSession({ seed });
  for (let level = 0; level < levels && !questDone(session.state()); level += 1)
    playLeg(session, seed);
  return session;
}
