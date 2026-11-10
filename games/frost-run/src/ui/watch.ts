import type { EffectName } from "../audio.ts";
import { ticksPerSecond } from "../rules/constants.ts";
import type { RunState } from "../rules/types.ts";
import { kindWords, roundWords, words } from "../words.ts";
import type { Controls } from "./controls.ts";
import type { Hud } from "./hud.ts";

// What the page does each frame while a run goes, beside the 3D screen: the readouts, the frost over the screen while frost vision holds,
// a beep for each of the last five seconds, a banner when a round ends, and the touch buttons each round offers.
export interface WatchParts {
  readonly controls: Controls;
  readonly hud: Hud;
  readonly sfx: (name: EffectName) => void;
  readonly stage: HTMLElement;
}

export function createWatch({
  controls,
  hud,
  sfx,
  stage,
}: WatchParts): (state: RunState, running: boolean) => void {
  let lastSecond = -1;
  let lastPhase = "";
  return (state, running) => {
    hud.update(state);
    stage.classList.toggle(
      "frosted",
      running && state.tick < state.player.visionUntil,
    );
    const second = Math.ceil(state.timeLeft / ticksPerSecond);
    if (
      state.phase === "play" &&
      second !== lastSecond &&
      second <= 5 &&
      second > 0
    )
      sfx("tick");
    lastSecond = second;
    if (state.phase !== lastPhase && state.phase === "interlude") {
      const tally = state.tallies[state.round];
      const name = roundWords[state.round]?.name ?? "";
      const haul = (["crystal", "egg", "key"] as const)
        .map((kind) => `${String(tally?.[kind] ?? 0)} ${kindWords[kind].many}`)
        .join(" · ");
      hud.banner(
        `${name} · ${tally?.cleared === true ? words.cleared : words.timeUp}`,
        haul,
      );
    }
    if (state.phase === "play") controls.forRound(state.round);
    lastPhase = state.phase;
  };
}
