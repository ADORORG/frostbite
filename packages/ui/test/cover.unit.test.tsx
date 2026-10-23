// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArcadePreview } from "../src/components/arcade-preview.tsx";
import {
  standInInitials,
  standInTone,
  standInTones,
} from "../src/components/stand-in.ts";
import { CoverCard, CoverGrid } from "../src/patterns/cover-grid.tsx";
import { show } from "./support/render.tsx";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("what stands in for a missing picture", () => {
  it("is the same for the same name and within the schemes there are", () => {
    expect(standInTone("Frost Bite")).toBe(standInTone("Frost Bite"));
    for (const name of ["", "a", "Tap Tower", "SDK Explorer", "★ Zürich"])
      expect(standInTone(name)).toBeLessThan(standInTones);
  });

  it("is not one scheme for every name", () => {
    const names = [
      "Frost Bite",
      "Tap Tower",
      "SDK Explorer",
      "Insert Coin",
      "Sample",
      "Public light",
    ];
    expect(new Set(names.map(standInTone)).size).toBeGreaterThan(2);
  });

  it("is the first letters of the first two words, capitals, whatever the separators", () => {
    expect(standInInitials("Frost Bite")).toBe("FB");
    expect(standInInitials("FROST·BITE")).toBe("FB");
    expect(standInInitials("tap")).toBe("T");
    expect(standInInitials("  the   quick brown fox ")).toBe("TQ");
    expect(standInInitials("")).toBe("");
    expect(standInInitials("★ ◆")).toBe("");
    expect(standInInitials("éclair au")).toBe("ÉA");
  });
});

describe("a preview that moves only while it is seen", () => {
  type Callback = (entries: { isIntersecting: boolean }[]) => void;
  function watching() {
    let notify: Callback = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: Callback) {
          notify = callback;
        }
        observe() {}
        disconnect() {
          disconnect();
        }
      },
    );
    return {
      disconnect,
      see: (isIntersecting: boolean) =>
        act(async () => notify([{ isIntersecting }])),
    };
  }
  const motionWelcome = () =>
    vi.stubGlobal("matchMedia", () => ({
      addEventListener: () => undefined,
      matches: false,
      removeEventListener: () => undefined,
    }));

  it("starts the clip when it scrolls into view and stops it when it scrolls away", async () => {
    motionWelcome();
    const view = watching();
    const box = await show(
      <ArcadePreview alt="A" image="/a.png" name="Frost" video="/a.mp4" />,
    );
    expect(box.querySelector("video")).toBeNull();
    await view.see(true);
    expect(box.querySelector("video")?.getAttribute("src")).toBe("/a.mp4");
    expect(box.firstElementChild?.getAttribute("data-playing")).toBe("true");
    await view.see(false);
    expect(box.querySelector("video")).toBeNull();
    expect(box.firstElementChild?.getAttribute("data-playing")).toBe("false");
  });

  it("stops watching when it is taken off the page", async () => {
    motionWelcome();
    const view = watching();
    const box = document.createElement("div");
    document.body.append(box);
    const root = createRoot(box);
    await act(async () =>
      root.render(
        <ArcadePreview alt="A" image="/a.png" name="Frost" video="/a.mp4" />,
      ),
    );
    await act(async () => root.unmount());
    expect(view.disconnect).toHaveBeenCalledTimes(1);
  });

  it("draws a named stand-in, with its initials, when there is no picture", async () => {
    motionWelcome();
    watching();
    const box = await show(
      <ArcadePreview alt="" image={null} name="Tap Tower" video={null} />,
    );
    const standIn = box.querySelector(".arcade-preview__stand-in");
    expect(standIn?.textContent).toBe("TT");
    expect(standIn?.className).toContain(
      `arcade-preview__stand-in--${String(standInTone("Tap Tower"))}`,
    );
  });
});

describe("a wall of covers", () => {
  it("makes one link of a card, named for what it does, with the words and the invitation inside", async () => {
    const box = await show(
      <CoverGrid label="Registered games">
        <CoverCard
          badges={<span>Playable</span>}
          cta="Play now"
          href="/games/frost"
          label="Play Frost"
          media={<img alt="" src="/a.png" />}
          summary="A game."
          title="Frost"
        />
      </CoverGrid>,
    );
    expect(box.querySelector("ul")?.getAttribute("aria-label")).toBe(
      "Registered games",
    );
    const links = box.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("/games/frost");
    expect(links[0]?.getAttribute("aria-label")).toBe("Play Frost");
    expect(box.querySelector(".cover-card__title")?.textContent).toBe("Frost");
    expect(box.querySelector(".cover-card__summary")?.textContent).toBe(
      "A game.",
    );
    expect(box.querySelector(".cover-card__badges")?.textContent).toBe(
      "Playable",
    );
    expect(box.querySelector(".cover-card__cta")?.textContent).toBe("Play now");
    expect(
      box.querySelector(".cover-card__cta")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("numbers a card like a score table when it is given a place, padded, and draws no number when it is not", async () => {
    const box = await show(
      <CoverGrid label="Wall">
        <CoverCard
          badges={null}
          cta="Go"
          href="/a"
          label="A"
          media={null}
          rank={3}
          summary="a"
          title="A"
        />
        <CoverCard
          badges={null}
          cta="Go"
          href="/b"
          label="B"
          media={null}
          rank={12}
          summary="b"
          title="B"
        />
        <CoverCard
          badges={null}
          cta="Go"
          href="/c"
          label="C"
          media={null}
          summary="c"
          title="C"
        />
      </CoverGrid>,
    );
    const ranks = [...box.querySelectorAll(".cover-card")].map(
      (card) => card.querySelector(".cover-card__rank")?.textContent ?? null,
    );
    expect(ranks).toEqual(["03", "12", null]);
    expect(
      box.querySelector(".cover-card__rank")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("marks the featured card and the shape of the picture, and leaves out a summary it does not have", async () => {
    const box = await show(
      <CoverGrid label="Wall">
        <CoverCard
          badges={null}
          cta="Go"
          featured
          href="/a"
          label="A"
          media={null}
          summary=""
          title="A"
        />
        <CoverCard
          badges={null}
          cta="Go"
          href="/b"
          label="B"
          media={null}
          ratio="square"
          summary="b"
          title="B"
        />
      </CoverGrid>,
    );
    const cards = [...box.querySelectorAll(".cover-card")];
    expect(cards.map((card) => card.getAttribute("data-featured"))).toEqual([
      "true",
      null,
    ]);
    expect(cards.map((card) => card.getAttribute("data-ratio"))).toEqual([
      "wide",
      "square",
    ]);
    expect(cards[0]?.querySelector(".cover-card__summary")).toBeNull();
    expect(cards[1]?.querySelector(".cover-card__summary")).not.toBeNull();
  });
});
