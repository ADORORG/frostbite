// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { attachButtons, noteFor } from "../src/page/buttons.ts";
import type { Hands } from "../src/page/controls.ts";
import {
  canPractise,
  colourOf,
  createHud,
  showEarned,
} from "../src/page/hud.ts";
import { breathOf, createMomentPanel, ringOf } from "../src/page/moment.ts";
import { createOverlay, toastMs } from "../src/page/overlay.ts";
import { createSelect } from "../src/page/select.ts";
import { huddleSkill } from "../src/rules/growth.ts";
import { beginMoment } from "../src/rules/moment.ts";
import { choiceIds } from "../src/rules/moments.ts";
import type { PlayState } from "../src/rules/types.ts";
import { choices } from "../src/script/lines.ts";
import { byId, loadPage } from "./support/dom.ts";
import { led } from "./support/states.ts";

beforeEach(loadPage);

const handsWith = (): Hands => ({
  act: vi.fn(),
  cards: vi.fn(),
  choose: vi.fn(),
  choosing: () => false,
  end: vi.fn(),
  inMoment: () => false,
  pause: vi.fn(),
  practise: vi.fn(),
  running: () => true,
  start: vi.fn(),
  steer: vi.fn(),
  turn: vi.fn(),
  vision: vi.fn(),
});

describe("choosing who leads", () => {
  it("shows a card for the one chosen, and turns round the family both ways", () => {
    const select = createSelect();
    const card = byId("hero");
    expect(card.hidden).toBe(true);
    select.show(true);
    expect(card.hidden).toBe(false);
    expect(byId("hero-name").textContent).toBe("Kai");
    expect(byId("hero-stats").querySelectorAll("dd")).toHaveLength(4);
    select.turn(1);
    expect(select.chosen()).toBe("zora");
    expect(byId("hero-name").textContent).toBe("Zora");
    expect(
      byId("hero-stats").querySelector("dd span")?.getAttribute("style"),
    ).toContain("60%");
    select.turn(-2);
    expect(select.chosen()).toBe("ali");
    expect(card.dataset.hero).toBe("ali");
    expect(createSelect("heerah").chosen()).toBe("heerah");
  });
});

describe("the readouts", () => {
  it("shows the colour, the family, the threads, the level, the score, the best and the spark", () => {
    const practised: number[] = [];
    const hud = createHud((skill) => practised.push(skill));
    const state = led({
      colour: [10, 20, 30, 40, 50, 60],
      party: ["zora"],
      score: 321,
      spark: 80,
      threads: 2,
    });
    hud.show(state, 900, true);
    expect(byId("colour").textContent).toBe("35%");
    expect(byId("family").textContent).toBe("2 of 4");
    expect(byId("threads").textContent).toBe("2 of 6");
    expect(byId("score").textContent).toBe("321");
    expect(byId("best").textContent).toBe("900");
    expect(byId("spark").dataset.mood).toBe("bright");
    expect(byId("spark-fill").style.inlineSize).toBe("80%");
    const buttons = [...byId("skills").querySelectorAll("button")];
    expect(buttons).toHaveLength(8);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
    buttons[2]?.click();
    expect(practised).toEqual([2]);
    hud.show({ ...state, spark: 10, lead: null }, 0, false);
    expect(byId("family").textContent).toBe("0 of 4");
    expect(byId("spark").dataset.mood).toBe("dim");
    expect(buttons.every((button) => button.disabled)).toBe(true);
    hud.show({ ...state, spark: 50, party: [] }, 0, true);
    expect(byId("spark").dataset.mood).toBe("steady");
    expect(buttons[huddleSkill]?.disabled).toBe(true);
    expect(colourOf({ ...state, colour: [] })).toBe(0);
  });

  it("lets a skill be practised only in a run, outside a moment, and the huddle only with family", () => {
    const state = led({ party: ["kai"] });
    expect(canPractise(state, 0)).toBe(true);
    expect(canPractise(state, huddleSkill)).toBe(true);
    expect(canPractise({ ...state, party: [] }, huddleSkill)).toBe(false);
    expect(canPractise({ ...state, ended: true }, 0)).toBe(false);
    expect(canPractise(beginMoment(state, "practice", 1), 0)).toBe(false);
  });

  it("lists the milestones earned by their titles", () => {
    const list = byId("earned");
    showEarned(list, new Map([["sparky", "Sparky"]]), ["sparky", "pancakes"]);
    expect([...list.children].map((item) => item.textContent)).toEqual([
      "Sparky",
      "pancakes",
    ]);
  });
});

describe("a moment over the screen", () => {
  const panel = () => {
    const chosen: number[] = [];
    return {
      chosen,
      shown: createMomentPanel((option) => chosen.push(option)),
    };
  };

  it("is hidden with no moment, and shows a beat's ring closing on its mark", () => {
    const { shown } = panel();
    const state = led();
    shown.show(state);
    expect(byId("moment").hidden).toBe(true);
    const forging = beginMoment(state, "forge");
    shown.show(forging);
    expect(byId("moment").hidden).toBe(false);
    expect(byId("moment-title").textContent).toBe(
      "The lamp that would not go out",
    );
    expect(byId("moment-hint").textContent).toContain("Cup on the beat");
    expect(byId("beat").hidden).toBe(false);
    expect(ringOf(forging)).toBe(0);
    const later = { ...forging, tick: forging.tick + 45 };
    expect(ringOf(later)).toBe(1);
    shown.show(later);
    expect(byId("beat-ring").style.transform).toBe("scale(1)");
    expect(ringOf(state)).toBe(0);
  });

  it("fills the breath bar for four counts in and empties it for six out", () => {
    const { shown } = panel();
    const breath = beginMoment(led(), "practice", 6);
    shown.show(breath);
    expect(byId("moment-title").textContent).toBe("Practise Breath");
    expect(byId("breath").hidden).toBe(false);
    expect(byId("moment-hint").textContent).toContain("Hold act");
    const moment = breath.moment;
    if (moment === null) throw new Error("no moment");
    const holding: PlayState = {
      ...breath,
      moment: { ...moment, holding: breath.tick },
      tick: breath.tick + 60,
    };
    expect(breathOf(holding)).toBe(0.5);
    shown.show(holding);
    expect(byId("breath-fill").style.inlineSize).toBe("50%");
    expect(byId("moment-hint").textContent).toContain("now let go");
    const out: PlayState = {
      ...breath,
      moment: { ...moment, exhaleUntil: breath.tick + 180 },
    };
    expect(breathOf(out)).toBe(1);
    shown.show(out);
    expect(byId("moment-hint").textContent).toContain("six counts");
    expect(breathOf(led())).toBe(0);
    expect(breathOf(breath)).toBe(0);
  });

  it("offers the two answers in the seed's order, and says which was chosen", () => {
    const { chosen, shown } = panel();
    const asked = beginMoment(led(), "grey", 2);
    const truth = asked.answers[choiceIds.indexOf("grey-2")] ?? 0;
    shown.show(asked);
    expect(byId("choices").hidden).toBe(false);
    expect(byId("moment-said").textContent).toContain(choices["grey-2"].said);
    expect(byId(`choice-${String(truth)}`).textContent).toBe(
      choices["grey-2"].truth,
    );
    expect(byId(`choice-${String(1 - truth)}`).textContent).toBe(
      choices["grey-2"].trick,
    );
    byId("choice-1").click();
    expect(chosen).toEqual([1]);
  });

  it("says what a lean, a huddle and a look in the mirror ask for", () => {
    const { shown } = panel();
    const leaning = beginMoment(led(), "ali");
    shown.show(leaning);
    expect(byId("moment-hint").textContent).toBe(
      "Act to sit down beside them.",
    );
    shown.show(beginMoment(led({ party: ["zora"] }), "practice", huddleSkill));
    expect(byId("moment-hint").textContent).toContain("gather close");
    const mirror = beginMoment(led(), "mirror", 0);
    const moment = mirror.moment;
    if (moment === null) throw new Error("no moment");
    shown.show({ ...mirror, moment: { ...moment, step: 1 } });
    expect(byId("moment-hint").textContent).toContain("mirror");
  });
});

describe("the prompt and the toasts over the screen", () => {
  it("names what the act key would do, and shows a toast for a while", () => {
    const overlay = createOverlay(() => "E");
    const state = led({ x: 0, z: 4_600 });
    overlay.show(state, 0);
    expect(byId("prompt").textContent).toBe("E: Touch the ancestor tree");
    overlay.show(led({ x: -9_000, z: -25_000 }), 0);
    expect(byId("prompt").textContent).toBe("");
    overlay.hear({ detail: "", kind: "sparky", tick: 1 }, 100);
    overlay.show(state, 200);
    expect(byId("toast").textContent).toContain("Sparky");
    overlay.hear({ detail: "", kind: "plasma", tick: 2 }, 300);
    overlay.show(state, 100 + toastMs - 1);
    expect(byId("toast").textContent).toContain("Sparky");
    overlay.show(state, 100 + toastMs);
    expect(byId("toast").textContent).toBe("");
  });
});

describe("the buttons under the screen", () => {
  it("offers Start and choosing before a run, and Pause, Act, Vision and End in one, never moving", () => {
    const hands = handsWith();
    const buttons = attachButtons(hands);
    buttons.show("ready");
    expect(buttons.start.hidden).toBe(false);
    expect(byId<HTMLButtonElement>("pause").disabled).toBe(true);
    expect(byId<HTMLButtonElement>("previous").disabled).toBe(false);
    byId("previous").click();
    byId("next").click();
    buttons.show("running");
    expect(buttons.start.hidden).toBe(true);
    expect(byId<HTMLButtonElement>("act").disabled).toBe(false);
    expect(byId<HTMLButtonElement>("end").disabled).toBe(false);
    expect(hands.turn).toHaveBeenNthCalledWith(1, -1);
    expect(hands.turn).toHaveBeenNthCalledWith(2, 1);
    byId("vision").click();
    byId("end").click();
    byId("pause").click();
    // Start is greyed out until the platform has answered; the page offers it then.
    buttons.start.disabled = false;
    buttons.start.click();
    expect(hands.vision).toHaveBeenCalledOnce();
    expect(hands.end).toHaveBeenCalledOnce();
    expect(hands.pause).toHaveBeenCalledOnce();
    expect(hands.start).toHaveBeenCalledOnce();
    // Cards is offered once the run has a share card.
    const shared = byId<HTMLButtonElement>("cards");
    expect(shared.disabled).toBe(true);
    buttons.offerCards(true);
    shared.click();
    expect(hands.cards).toHaveBeenCalledOnce();
    const act = byId("act");
    act.dispatchEvent(new MouseEvent("pointerdown"));
    act.dispatchEvent(new MouseEvent("pointerup"));
    act.dispatchEvent(new MouseEvent("click", { detail: 1 }));
    act.dispatchEvent(new MouseEvent("click", { detail: 0 }));
    expect(hands.act).toHaveBeenCalledTimes(4);
  });

  it("says how to choose and begin, how to play in a run, and nothing after", () => {
    expect(noteFor("ready")).toContain("choose who leads");
    expect(noteFor("choosing")).toBe(noteFor("ready"));
    expect(noteFor("running")).toContain("Q opens vision");
    expect(noteFor("over")).toBe("");
    expect(noteFor("ending")).toBe("");
  });
});
