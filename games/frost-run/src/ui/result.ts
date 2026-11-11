import { perRound, roundCount } from "../rules/constants.ts";
import { leads } from "../rules/leads.ts";
import { needed, totals } from "../rules/round.ts";
import type { ItemKind, RunState } from "../rules/types.ts";
import { heroWords, kindWords, roundWords, words } from "../words.ts";

// The card after a run: whether the run was won, the whole run's treasure against what it needed, each round in a line, the milestones it
// earned, and the ways on: again, a share card, or another hero. On a touch screen a tap anywhere plays again, so the card says so and
// keeps two buttons.
const kinds: readonly ItemKind[] = ["crystal", "egg", "key"];

export interface RunSummary {
  readonly best: number;
  readonly earned: readonly string[];
  readonly newBest: boolean;
  readonly state: RunState;
}

export interface ResultEvents {
  readonly again: () => void;
  readonly change: () => void;
  readonly share: () => void;
}

const make = (tag: string, className: string, text = ""): HTMLElement => {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
};

export function createResult(
  panel: HTMLElement,
  events: ResultEvents,
): { readonly show: (summary: RunSummary | null) => void } {
  const part = (name: string): HTMLElement => {
    const found = panel.querySelector(`[data-part="${name}"]`);
    if (!(found instanceof HTMLElement)) throw new Error(`Missing ${name}`);
    return found;
  };
  part("again").addEventListener("click", () => events.again());
  part("change").addEventListener("click", () => events.change());
  part("share").addEventListener("click", () => events.share());
  part("again").textContent = words.playAgain;
  part("change").textContent = words.changeHero;
  part("share").textContent = words.share;
  part("tap").textContent = words.tapAgain;

  return {
    show(summary) {
      panel.hidden = summary === null;
      if (summary === null) return;
      const { state } = summary;
      const lead = leads[state.lead];
      const hero = lead === undefined ? null : heroWords[lead.id];
      panel.dataset.won = String(state.won);
      part("verdict").textContent = state.won ? words.win : words.lose;
      part("who").textContent =
        `${hero?.name ?? ""} · ${String(state.score)} pts${summary.newBest ? " · new best" : ` · best ${String(summary.best)}`}`;
      const sum = totals(state.tallies);
      part("haul").replaceChildren(
        ...kinds.map((kind) => {
          const row = make(
            "li",
            `haul-row ${sum[kind] >= needed(kind) ? "met" : "short"}`,
          );
          row.dataset.kind = kind;
          row.append(
            make("span", "icon"),
            make("span", "what", kindWords[kind].many),
            make(
              "strong",
              "got",
              `${String(sum[kind])}/${String(perRound[kind] * roundCount)}`,
            ),
            make("span", "need", `need ${String(needed(kind))}`),
          );
          return row;
        }),
      );
      part("rounds").replaceChildren(
        ...state.tallies.map((tally, index) => {
          const row = make("li", `round-row${tally.cleared ? " cleared" : ""}`);
          row.append(
            make("span", "where", roundWords[index]?.name ?? ""),
            make(
              "span",
              "what",
              `${String(tally.crystal)} · ${String(tally.egg)} · ${String(tally.key)}`,
            ),
            make("span", "tag", tally.cleared ? words.cleared : ""),
          );
          return row;
        }),
      );
      part("earned").replaceChildren(
        ...summary.earned.map((title) => make("li", "chip", title)),
      );
    },
  };
}
