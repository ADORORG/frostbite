import { stepInt } from "@frostbite/game-sdk/seeded";

import type { Action } from "../../src/rules/types.ts";
import { createRunSession, type RunSession } from "../../src/session.ts";
import { plansFor } from "./placements.ts";

// A player, by how it plays: how many ticks it takes to decide a piece, how often it settles for a poorer place than its best, and how
// many ticks it lets between one key and the next. Each key it presses is the session's, so what it plays is recorded as a player's is.
export interface Skill {
  readonly keyGap: number;
  // Looks at the next piece too before it chooses a place.
  readonly looksAhead?: boolean;
  // The chance in a hundred that it takes the second best place, then the third.
  readonly slip: number;
  readonly think: number;
}

export const novice: Skill = { keyGap: 4, slip: 30, think: 90 };
export const decent: Skill = { keyGap: 2, slip: 8, think: 30 };
export const expert: Skill = { keyGap: 1, slip: 0, think: 8 };
export const ace: Skill = { keyGap: 1, looksAhead: true, slip: 0, think: 5 };

export interface BotOptions {
  readonly seed: number;
  readonly skill: Skill;
  // Stop once this holds, or after this many ticks.
  readonly until?: (session: RunSession) => boolean;
  readonly ticks: number;
}

function waitFor(session: RunSession, ticks: number): void {
  for (let at = 0; at < ticks && !session.over(); at += 1) session.tick();
}

// Plays a run: waits to decide, then turns, slides and drops the piece in hand, until the stack reaches the top, `until` is met or the
// ticks are spent.
export function playBot(options: BotOptions): RunSession {
  const session = createRunSession({ seed: options.seed });
  let luck = options.seed >>> 0 || 1;
  while (
    !session.over() &&
    session.clock() < options.ticks &&
    options.until?.(session) !== true
  ) {
    waitFor(session, options.skill.think);
    if (session.over()) break;
    const plans = plansFor(
      session.state(),
      false,
      options.skill.looksAhead === true,
    );
    const roll = stepInt(luck, 100);
    luck = roll.state;
    const pick = roll.value < options.skill.slip ? (roll.value % 2) + 1 : 0;
    const plan = plans[Math.min(pick, plans.length - 1)];
    for (const key of plan?.keys ?? ["hard" as const]) {
      session.press(key);
      waitFor(session, options.skill.keyGap);
    }
  }
  return session;
}

// A player who never touches a key: the pieces fall where they are born until the stack reaches the top.
export function playIdle(seed: number, ticks: number): RunSession {
  const session = createRunSession({ seed });
  waitFor(session, ticks);
  return session;
}

const everyKey: readonly Action[] = [
  "left",
  "right",
  "turnRight",
  "turnLeft",
  "hard",
  "hold",
  "softOn",
  "softOff",
];

// A player who presses any key at random every few ticks, with no idea what it does.
export function playRandom(seed: number, ticks: number): RunSession {
  const session = createRunSession({ seed });
  let luck = seed >>> 0 || 1;
  while (!session.over() && session.clock() < ticks) {
    const roll = stepInt(luck, everyKey.length);
    luck = roll.state;
    session.press(everyKey[roll.value] ?? "hard");
    waitFor(session, 6);
  }
  return session;
}
