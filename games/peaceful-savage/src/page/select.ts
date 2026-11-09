import { type HeroId, heroIds } from "../rules/constants.ts";
import { stats } from "../rules/cast.ts";
import { heroCards, statNames } from "../script/cast.ts";
import { element } from "./elements.ts";

// Choosing who leads: the family stands in a line on the lawn (the view turns to whoever is chosen) and their card is laid over the
// screen: name, who they are, four stat bars, what they bring, and their story. The arrows (or a swipe) turn to the next.
export interface Select {
  // Who is chosen now.
  readonly chosen: () => HeroId;
  // Shows or hides the card.
  readonly show: (shown: boolean) => void;
  // Turns to the next (1) or the one before (-1).
  readonly turn: (by: number) => void;
}

const statOrder = ["speed", "calm", "vision", "heart"] as const;

export function createSelect(start: HeroId = "kai"): Select {
  const card = element("hero", "div");
  const name = element("hero-name", "h2");
  const tag = element("hero-tag", "p");
  const bars = element("hero-stats", "dl");
  const ability = element("hero-ability", "p");
  const lesson = element("hero-lesson", "p");
  const story = element("hero-story", "p");
  let at = Math.max(0, heroIds.indexOf(start));

  function fill(): void {
    const hero = heroIds[at] ?? "kai";
    const words = heroCards[hero];
    card.dataset.hero = hero;
    name.textContent = words.name;
    tag.textContent = words.tag;
    ability.textContent = words.ability;
    lesson.textContent = words.lesson;
    story.textContent = words.story;
    bars.replaceChildren(
      ...statOrder.flatMap((stat) => {
        const term = document.createElement("dt");
        term.textContent = statNames[stat];
        const value = document.createElement("dd");
        const bar = document.createElement("span");
        const amount = stats[hero][stat];
        bar.style.inlineSize = `${String(amount * 20)}%`;
        value.append(bar);
        value.setAttribute("aria-label", `${String(amount)} of 5`);
        return [term, value];
      }),
    );
  }

  fill();
  return {
    chosen: () => heroIds[at] ?? "kai",
    show(shown) {
      card.hidden = !shown;
    },
    turn(by) {
      at = (((at + by) % heroIds.length) + heroIds.length) % heroIds.length;
      fill();
    },
  };
}
