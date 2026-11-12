import { beatLead, breathInTicks, breathOutTicks } from "../rules/constants.ts";
import { stepOf } from "../rules/moment.ts";
import { choiceIds } from "../rules/moments.ts";
import type { PlayState } from "../rules/types.ts";
import { skillCards } from "../script/cast.ts";
import { choices, momentTitles, stepWords } from "../script/lines.ts";
import { element } from "./elements.ts";

// The moment the lead is in, laid over the screen: its title, what is said, and what the step asks for. A beat shows a ring closing on
// its mark (press as it lands); a breath, a bar that fills for four counts in and empties for six out; a choice, the two answers as
// buttons, in the order the seed gave them.
export interface MomentPanel {
  readonly show: (state: PlayState) => void;
}

const keyNames = ["Cup", "Comb", "Knot", "Knock", "Split", "Let-Go"] as const;
const keyIndex = (key: string): number =>
  ["cup", "comb", "knot", "knock", "split", "letgo"].indexOf(key);

// How far a beat's ring has closed (0 as it is set, 1 on the mark), and how full the breath bar is (0 to 1).
export const ringOf = (state: PlayState): number => {
  const moment = state.moment;
  if (moment === null || moment.target < 0) return 0;
  return Math.max(0, Math.min(1, 1 - (moment.target - state.tick) / beatLead));
};

export const breathOf = (state: PlayState): number => {
  const moment = state.moment;
  if (moment === null) return 0;
  if (moment.holding >= 0)
    return Math.min(1, (state.tick - moment.holding) / breathInTicks);
  if (moment.exhaleUntil >= 0)
    return Math.max(0, (moment.exhaleUntil - state.tick) / breathOutTicks);
  return 0;
};

export function createMomentPanel(
  choose: (option: number) => void,
): MomentPanel {
  const panel = element("moment", "div");
  const title = element("moment-title", "h2");
  const said = element("moment-said", "p");
  const hint = element("moment-hint", "p");
  const beat = element("beat", "div");
  const ring = element("beat-ring", "span");
  const breath = element("breath", "div");
  const fill = element("breath-fill", "span");
  const answers = element("choices", "div");
  const buttons = [
    element("choice-0", "button"),
    element("choice-1", "button"),
  ];
  buttons.forEach((button, option) => {
    button.addEventListener("click", () => {
      choose(option);
    });
  });

  return {
    show(state) {
      const moment = state.moment;
      const step = stepOf(state);
      panel.hidden = moment === null || step === null || state.ended;
      if (moment === null || step === null) return;
      title.textContent =
        moment.kind === "practice"
          ? `Practise ${skillCards[moment.skill]?.name ?? ""}`
          : momentTitles[moment.kind];
      beat.hidden = step.kind !== "beat";
      breath.hidden = step.kind !== "breath";
      answers.hidden = step.kind !== "choose";
      said.textContent = "";
      if (step.kind === "beat") {
        const name = keyNames[keyIndex(step.key)] ?? "";
        hint.textContent = `${name} ${stepWords.beat}`;
        ring.style.transform = `scale(${String(1.85 - ringOf(state) * 0.85)})`;
        beat.dataset.key = step.key;
      } else if (step.kind === "breath") {
        hint.textContent =
          moment.holding >= 0
            ? stepWords.breathHold
            : moment.exhaleUntil >= 0
              ? stepWords.breathOut
              : stepWords.breathIn;
        fill.style.inlineSize = `${String(Math.round(breathOf(state) * 100))}%`;
      } else if (step.kind === "choose") {
        const words = choices[step.choice];
        const truth = state.answers[choiceIds.indexOf(step.choice)] ?? 0;
        said.textContent = `${words.who}: “${words.said}”`;
        hint.textContent = stepWords.choose;
        buttons.forEach((button, option) => {
          button.textContent = option === truth ? words.truth : words.trick;
        });
      } else hint.textContent = stepWords[step.kind];
    },
  };
}
