import type { EffectName } from "../audio.ts";
import { castleSounds, hillsSounds, woodsSounds } from "../feedback.ts";
import { createQuestSession, type QuestSession } from "../quest-session.ts";
import type { ChapterId } from "../rules/constants.ts";
import { legHearts, legShown, onLeg, type Leg } from "../rules/quest/legs.ts";
import {
  questEggs,
  questPlasma,
  questScore,
  questSecrets,
  questStats,
} from "../score.ts";
import { drawQuest } from "../screen/quest-draw.ts";
import type { Action } from "./hands.ts";
import {
  castleLook,
  hillsLook,
  holdOn,
  woodsLook,
  type PlayRun,
} from "./runs.ts";

// The whole quest as the page sees it: the same as a level's run (`runs.ts`), except that what the actions mean, how the screen looks
// and what is heard follow the level being played. A key still held when a new level begins is pressed again in it.
const means: Readonly<
  Record<ChapterId, Readonly<Partial<Record<Action, string>>>>
> = {
  castle: castleLook.means,
  hills: hillsLook.means,
  woods: woodsLook.means,
};

// What is heard between two ticks of one level (nothing when the level changed in between).
const soundsBetween = (before: Leg, after: Leg): readonly EffectName[] =>
  onLeg(before, {
    castle: (was) =>
      after.id === "castle" ? castleSounds(was, after.state) : [],
    hills: (was) => (after.id === "hills" ? hillsSounds(was, after.state) : []),
    woods: (was) => (after.id === "woods" ? woodsSounds(was, after.state) : []),
  });

export const startQuestRun = (
  seed: number,
  onEarned?: (milestone: string) => void,
): PlayRun => questRun(createQuestSession({ onEarned, seed }));

export function questRun(session: QuestSession): PlayRun {
  const held = new Set<Action>();
  const won = (): boolean => session.state().finishTick !== null;
  return {
    // The levels before the one being played, and that one once it is cleared (while the dimension shifts, or the quest won).
    cleared() {
      const state = session.state();
      return [
        ...state.past.map((leg) => leg.id),
        ...(won() || state.shift !== null ? [state.leg.id] : []),
      ];
    },
    depth() {
      const shown = legShown(session.state().leg);
      return shown.id === "woods" && shown.state.base !== null
        ? shown.state
        : null;
    },
    draw: (context, layered) => drawQuest(context, session.state(), layered),
    earned: () => session.earned(),
    ended: () => session.state().ended,
    fame() {
      const state = session.state();
      return state.finishTick === null
        ? null
        : {
            eggs: questEggs(state),
            hearts: legHearts(state.leg),
            score: questScore(state),
            secrets: questSecrets(state),
            ticks: state.finishTick,
          };
    },
    hold: (action, on) =>
      holdOn(means[session.state().leg.id], held, action, on, session.hold),
    id: "quest",
    level: () => session.state().leg.id,
    plasma: () => questPlasma(session.state()),
    record: () => session.record(),
    score: () => questScore(session.state()),
    stats: () => questStats(session.state()),
    tick() {
      const before = session.state();
      session.tick();
      const after = session.state();
      if (before.leg.id !== after.leg.id) {
        for (const action of held)
          holdOn(means[after.leg.id], held, action, true, session.hold);
        return ["start"];
      }
      const heard = soundsBetween(legShown(before.leg), legShown(after.leg));
      return before.shift === null && after.shift !== null
        ? [...heard, "stage"]
        : heard;
    },
    won,
  };
}
