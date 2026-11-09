import { heroIds } from "../rules/constants.ts";
import { huddleSkill, masteryCap, masteryLevel } from "../rules/growth.ts";
import { family } from "../rules/state.ts";
import type { PlayState } from "../rules/types.ts";
import { skillCards } from "../script/cast.ts";
import { element } from "./elements.ts";

// The readouts: how much colour the house has back, the family walking together, the maridium threads, the lead's level, the score and
// the best; the spark bar over the screen; and the skills to practise, each with how far it is mastered. Every one has a place of its
// own that never grows, so nothing under the player's hand moves as the numbers change.
export interface Hud {
  readonly show: (state: PlayState, best: number, running: boolean) => void;
}

const masteryWords = ["new", "practised", "skilled", "mastered"] as const;

// How much colour the whole house and meadow have back, from its grey start to all of it (0 to 100).
export const colourOf = (state: PlayState): number =>
  Math.round(
    state.colour.reduce((sum, each) => sum + each, 0) /
      Math.max(1, state.colour.length),
  );

// Whether a skill can be practised now: in a run, outside a moment, and (the huddle) with family to huddle with.
export const canPractise = (state: PlayState, skill: number): boolean =>
  state.lead !== null &&
  !state.ended &&
  state.moment === null &&
  (skill !== huddleSkill || state.party.length > 0);

export function createHud(practise: (skill: number) => void): Hud {
  const colour = element("colour", "strong");
  const together = element("family", "strong");
  const threads = element("threads", "strong");
  const level = element("level", "strong");
  const score = element("score", "strong");
  const best = element("best", "strong");
  const spark = element("spark-fill", "span");
  const sparkBox = element("spark", "div");
  const list = element("skills", "ul");
  const rows = skillCards.map((card, skill) => {
    const item = document.createElement("li");
    const meter = document.createElement("meter");
    meter.max = masteryCap;
    meter.value = 0;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${String(skill + 1)} ${card.name}`;
    button.setAttribute("aria-label", `Practise ${card.name}: ${card.does}`);
    button.title = card.does;
    button.dataset.skill = String(skill);
    button.disabled = true;
    button.addEventListener("click", () => {
      practise(skill);
    });
    item.append(button, meter);
    return { button, item, meter };
  });
  list.replaceChildren(...rows.map((row) => row.item));

  return {
    show(state, bestSoFar, running) {
      colour.textContent = `${String(colourOf(state))}%`;
      together.textContent = `${String(state.lead === null ? 0 : family(state).length)} of ${String(heroIds.length)}`;
      threads.textContent = `${String(state.threads)} of 6`;
      level.textContent = String(state.level);
      score.textContent = String(state.score);
      best.textContent = String(bestSoFar);
      spark.style.inlineSize = `${String(state.spark)}%`;
      sparkBox.dataset.mood =
        state.spark < 25 ? "dim" : state.spark >= 75 ? "bright" : "steady";
      sparkBox.setAttribute("aria-valuenow", String(state.spark));
      rows.forEach(({ button, meter }, skill) => {
        const points = state.mastery[skill] ?? 0;
        meter.value = points;
        meter.title = masteryWords[masteryLevel(points)] ?? "";
        button.disabled = !running || !canPractise(state, skill);
      });
    },
  };
}

// The milestones earned this run, by their titles from the platform.
export function showEarned(
  list: HTMLElement,
  titles: ReadonlyMap<string, string>,
  ids: readonly string[],
): void {
  list.replaceChildren(
    ...ids.map((id) => {
      const item = document.createElement("li");
      item.dataset.milestone = id;
      item.textContent = titles.get(id) ?? id;
      return item;
    }),
  );
}
