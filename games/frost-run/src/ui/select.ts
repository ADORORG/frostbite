import { leads, type Lead } from "../rules/leads.ts";
import { heroWords, statNames, words } from "../words.ts";

// The card beside the turntable: who the hero is, five bars for how they play (worked out from the rules' own numbers, so the card never
// says what the hero does not do), their signature, a line of story, and the way to play as them. A mouse has the two arrows and the play
// button; a touch screen has neither (its page keeps to a few icons), so there the card says to swipe and to tap, and the dots show which
// of the five is in front.
const clamp = (value: number): number => Math.max(1, Math.min(5, value));

export const statsOf = (lead: Lead): readonly number[] => [
  clamp(2 + (3 * (lead.runSpeed - 79)) / 13),
  clamp(2 + (3 * (lead.hopSpeed - 118)) / 8),
  clamp(2 + (3 * (lead.hoverTicks - 92)) / 78),
  clamp(
    2 +
      (300 - lead.hitPenalty) / 40 +
      lead.freeHitsPerRound * 2 +
      (230 - lead.knockSpeed) / 60,
  ),
  clamp(
    2 +
      lead.reachBonus / 100 +
      (lead.visionTicks - 210) / 60 +
      (lead.boltLife - 44) / 12 +
      (lead.growTicks - 240) / 60 +
      (lead.rollBreaksBig ? 1.2 : 0) +
      (lead.rollSpeed - 180) / 30,
  ),
];

export interface SelectPanel {
  readonly show: (index: number) => void;
}

export interface SelectEvents {
  readonly play: () => void;
  readonly turn: (step: number) => void;
}

export function createSelect(
  panel: HTMLElement,
  events: SelectEvents,
): SelectPanel {
  const part = (name: string): HTMLElement => {
    const found = panel.querySelector(`[data-part="${name}"]`);
    if (!(found instanceof HTMLElement)) throw new Error(`Missing ${name}`);
    return found;
  };
  const name = part("name");
  const kind = part("kind");
  const signature = part("signature");
  const story = part("story");
  const stats = part("stats");
  const dots = part("dots");
  const play = part("play");
  part("previous").addEventListener("click", () => events.turn(-1));
  part("next").addEventListener("click", () => events.turn(1));
  play.addEventListener("click", () => events.play());

  stats.replaceChildren(
    ...statNames.map((label) => {
      const row = document.createElement("div");
      row.className = "stat";
      const title = document.createElement("span");
      title.textContent = label;
      const bar = document.createElement("span");
      bar.className = "bar-track";
      const fill = document.createElement("span");
      fill.className = "bar-fill";
      bar.append(fill);
      row.append(title, bar);
      return row;
    }),
  );
  part("swipe").textContent = words.swipe;
  dots.replaceChildren(
    ...leads.map(() => {
      const dot = document.createElement("span");
      dot.className = "dot";
      return dot;
    }),
  );

  return {
    show(index) {
      const lead = leads[index];
      if (lead === undefined) return;
      const hero = heroWords[lead.id];
      name.textContent = hero.name;
      kind.textContent = hero.kind;
      signature.textContent = hero.signature;
      story.textContent = hero.story;
      play.textContent = words.playAs(hero.name);
      panel.dataset.hero = lead.id;
      statsOf(lead).forEach((value, at) => {
        const fill =
          stats.children[at]?.querySelector<HTMLElement>(".bar-fill");
        if (fill !== null && fill !== undefined)
          fill.style.width = `${String(value * 20)}%`;
        stats.children[at]?.setAttribute(
          "aria-label",
          `${statNames[at] ?? ""} ${value.toFixed(1)} of 5`,
        );
      });
      [...dots.children].forEach((dot, at) =>
        dot.classList.toggle("on", at === index),
      );
    },
  };
}
