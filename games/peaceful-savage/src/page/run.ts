import type { RunRecord } from "@frostbite/game-sdk/run-record";

import { type HeroId, heroIds } from "../rules/constants.ts";
import type { News, PlayState } from "../rules/types.ts";
import { createRunSession, type InputType, type Outcome } from "../session.ts";
import { suggestedSkill } from "./practice.ts";
import { type Ground, wayFor } from "./steer.ts";

// One run as the page plays it: the session, with the player's hands turned into the rules' inputs. The lead is chosen first. A way to
// walk is fixed when the player's push changes (seen from where the camera looked then), so a camera swinging round behind the lead
// never bends a straight walk; and while a push is held it is asked for again whenever the lead stands still without meaning to (after
// a moment ends, say). Running is asked for only while walking, and only when it changes. Every piece of news is heard once.
export interface Play {
  readonly act: (down: boolean) => void;
  readonly choose: (option: number) => void;
  // Closes the run where it stands (the player's choice to stop): it is sent as it is.
  readonly end: () => void;
  readonly practise: (skill: number) => void;
  // The state before the last ticks, to ease between.
  readonly previous: () => PlayState;
  readonly record: () => RunRecord;
  readonly state: () => PlayState;
  // Where the player pushes, seen from the camera's `forward`, and whether they run.
  readonly steer: (
    push: { readonly x: number; readonly y: number } | null,
    forward: Ground,
    fast?: boolean,
  ) => void;
  readonly tick: (ticks: number) => void;
  readonly vision: () => void;
}

export interface PlayOptions {
  readonly hero: HeroId;
  readonly onEarned?: (milestone: string) => void;
  readonly onNews?: (news: News) => void;
  readonly seed: number;
}

export function startPlay(options: PlayOptions): Play {
  const session = createRunSession({
    ...(options.onEarned === undefined ? {} : { onEarned: options.onEarned }),
    seed: options.seed,
  });
  let heard: News | null = null;
  let wanted = -1;
  let hurried = false;
  const listen = (): void => {
    const news = session.state().news;
    if (news === null || news === heard) return;
    heard = news;
    options.onNews?.(news);
  };
  const input = (
    type: InputType,
    fields?: Readonly<Record<string, number>>,
  ): Outcome => {
    const outcome = session.input(type, fields);
    listen();
    return outcome;
  };
  // Walks the way wanted, if the lead is not already and may.
  const keepWalking = (): void => {
    const state = session.state();
    if (state.ended || state.moment !== null) return;
    const fast = hurried && wanted >= 0;
    if (state.hurrying !== fast) input("hurry", { fast: fast ? 1 : 0 });
    if (state.moving !== wanted) input("move", { way: wanted });
  };
  input("lead", { hero: heroIds.indexOf(options.hero) });
  let before = session.state();
  return {
    act(down) {
      const state = session.state();
      if (down) input("act");
      else if (state.moment !== null && state.moment.holding >= 0)
        input("release");
    },
    choose(option) {
      input("choose", { option });
    },
    end() {
      input("end");
    },
    practise(skill) {
      const state = session.state();
      input("practice", { skill: skill < 0 ? suggestedSkill(state) : skill });
    },
    previous: () => before,
    record: () => session.record(),
    state: () => session.state(),
    steer(push, forward, fast = false) {
      wanted = push === null ? -1 : wayFor(push, forward);
      hurried = fast;
      keepWalking();
    },
    tick(ticks) {
      if (ticks <= 0) return;
      before = session.state();
      for (let at = 0; at < ticks && !session.state().ended; at += 1) {
        session.tick();
        listen();
      }
      keepWalking();
    },
    vision() {
      input("vision");
    },
  };
}
