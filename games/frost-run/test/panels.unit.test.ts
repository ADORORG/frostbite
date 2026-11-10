// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { leads } from "../src/rules/leads.ts";
import { createResult } from "../src/ui/result.ts";
import { createSelect, statsOf } from "../src/ui/select.ts";
import { createShare } from "../src/ui/share.ts";
import { heroWords, words } from "../src/words.ts";
import { playBot, lingering } from "./support/bot.ts";
import { recorder } from "./support/canvas.ts";
import { byId, click, loadPage } from "./support/dom.ts";

beforeEach(loadPage);
afterEach(() => vi.unstubAllGlobals());

const part = (panel: HTMLElement, name: string) =>
  panel.querySelector(`[data-part="${name}"]`);

describe("the hero select", () => {
  it("shows each hero with five bars worked out from the rules, and turns and chooses", () => {
    const panel = byId("select", HTMLElement);
    const events = { play: vi.fn(), turn: vi.fn() };
    const select = createSelect(panel, events);
    for (const [index, lead] of leads.entries()) {
      select.show(index);
      expect(part(panel, "name")?.textContent).toBe(heroWords[lead.id].name);
      expect(part(panel, "play")?.textContent).toBe(
        words.playAs(heroWords[lead.id].name),
      );
      expect(panel.dataset.hero).toBe(lead.id);
      // The dots are marks, not buttons: one is lit, for the hero in front, and none can be pressed or reached.
      const dots = [...panel.querySelectorAll(".dot")];
      expect(dots.map((dot) => dot.classList.contains("on"))).toEqual(
        leads.map((_, at) => at === index),
      );
      expect(panel.querySelectorAll(".dots button")).toHaveLength(0);
      for (const value of statsOf(lead)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(5);
      }
    }
    select.show(leads.length);
    expect(part(panel, "name")?.textContent).toBe(
      heroWords[leads.at(-1)?.id ?? "pip"].name,
    );
    expect(part(panel, "swipe")?.textContent).toBe(words.swipe);
    click(part(panel, "previous"));
    click(part(panel, "next"));
    click(part(panel, "play"));
    expect(events.turn.mock.calls).toEqual([[-1], [1]]);
    expect(events.play).toHaveBeenCalledOnce();
  });

  it("refuses a page that is missing one of its parts", () => {
    const panel = byId("select", HTMLElement);
    part(panel, "story")?.remove();
    const events = { play: vi.fn(), turn: vi.fn() };
    expect(() => createSelect(panel, events)).toThrow("Missing story");
  });
});

describe("the card after a run", () => {
  it("says whether the run was won, what it took against what it needed, and what it earned", () => {
    const panel = byId("result", HTMLElement);
    const events = { again: vi.fn(), change: vi.fn(), share: vi.fn() };
    const result = createResult(panel, events);
    const won = playBot(1004, 4).state;
    result.show({
      best: 9000,
      earned: ["First spark"],
      newBest: true,
      state: won,
    });
    expect(panel.hidden).toBe(false);
    expect(panel.dataset.won).toBe("true");
    expect(part(panel, "verdict")?.textContent).toBe(words.win);
    expect(part(panel, "who")?.textContent).toContain("new best");
    expect(panel.querySelectorAll(".haul-row.met")).toHaveLength(3);
    expect(panel.querySelectorAll(".round-row.cleared")).toHaveLength(3);
    expect(panel.querySelector(".chip")?.textContent).toBe("First spark");
    const lost = playBot(31, 4, lingering).state;
    result.show({ best: 9000, earned: [], newBest: false, state: lost });
    expect(part(panel, "verdict")?.textContent).toBe(words.lose);
    expect(part(panel, "who")?.textContent).toContain("best 9000");
    expect(panel.querySelectorAll(".haul-row.short").length).toBeGreaterThan(0);
    click(part(panel, "again"));
    click(part(panel, "share"));
    click(part(panel, "change"));
    expect(events.again).toHaveBeenCalledOnce();
    expect(events.share).toHaveBeenCalledOnce();
    expect(events.change).toHaveBeenCalledOnce();
    result.show(null);
    expect(panel.hidden).toBe(true);
  });
});

describe("the share card's window", () => {
  const stubPictures = (loads: boolean) =>
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => (loads ? this.onload?.() : this.onerror?.()));
        }
      },
    );

  it("draws the card as a picture to save by hand, square or tall, and closes", async () => {
    const surface = recorder();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      surface.context as never,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,QUJD",
    );
    stubPictures(true);
    const panel = byId("share", HTMLElement);
    const share = createShare(panel);
    expect(part(panel, "hint")?.textContent).toBe(words.holdHint);
    const { state } = playBot(1004, 4);
    await share.open(state, "data:image/png;base64,QUJD");
    expect(panel.hidden).toBe(false);
    expect(panel.dataset.shape).toBe("square");
    const image = part(panel, "card");
    expect(image?.getAttribute("src")).toBe("data:image/png;base64,QUJD");
    expect(image?.getAttribute("alt")).toBe(words.win);
    expect(surface.texts()).toContain(words.title.toUpperCase());
    click(part(panel, "story"));
    expect(panel.dataset.shape).toBe("story");
    expect(part(panel, "story")?.getAttribute("aria-pressed")).toBe("true");
    click(part(panel, "square"));
    expect(panel.dataset.shape).toBe("square");
    click(part(panel, "close"));
    expect(panel.hidden).toBe(true);
    stubPictures(false);
    await share.open(playBot(31, 4, lingering).state, "data:,");
    expect(part(panel, "card")?.getAttribute("alt")).toBe(words.lose);
    share.close();
    expect(panel.hidden).toBe(true);
  });
});
