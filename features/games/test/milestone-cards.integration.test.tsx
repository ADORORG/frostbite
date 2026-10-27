// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { GameClaim } from "@ador/shared/games";

import { MilestoneList } from "../src/ui/milestone-list.tsx";
import { claimAt } from "./support/claims-ui.tsx";

const milestone = (id: string, title: string, over = {}) => ({
  claimPolicy: "once" as const,
  criteria: `Do ${title}.`,
  description: "d",
  id,
  title,
  ...over,
});
const milestones = [
  milestone("alpha", "Alpha"),
  milestone("bravo", "Bravo", { verification: "replay-verified" as const }),
  milestone("charlie", "Charlie"),
];
const at = "2026-10-05T00:00:00.000Z";
const progress = { counts: {}, levels: {}, totals: {} };

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(() => document.body.replaceChildren());

async function show(over: {
  claims?: Record<string, GameClaim>;
  unlocked?: Record<string, string> | null;
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const start = vi.fn();
  const review = vi.fn();
  await act(async () =>
    createRoot(container).render(
      <MilestoneList
        claim={{
          latestOf: (id) => over.claims?.[id] ?? null,
          message: null,
          review,
          start,
        }}
        milestones={milestones}
        progress={progress}
        unlocked={over.unlocked === undefined ? {} : over.unlocked}
      />,
    ),
  );
  const card = (id: string) =>
    container.querySelector(`[data-milestone="${id}"]`);
  return { card, container, review, start };
}
const buttons = (card: Element | null) =>
  [...(card?.querySelectorAll("button") ?? [])].map(
    (button) => button.textContent,
  );

describe("the milestone cards", () => {
  it("puts the reached ones first, each group in the game's own order", async () => {
    const { container } = await show({ unlocked: { alpha: at, charlie: at } });
    expect(
      [...container.querySelectorAll("[data-milestone]")].map(
        (item) => (item as HTMLElement).dataset["milestone"],
      ),
    ).toEqual(["alpha", "charlie", "bravo"]);
  });

  it("keeps the game's order when nothing is known of the player, and says nothing of a state or a claim", async () => {
    const { card, container } = await show({ unlocked: null });
    expect(
      [...container.querySelectorAll("[data-milestone]")].map(
        (item) => (item as HTMLElement).dataset["milestone"],
      ),
    ).toEqual(["alpha", "bravo", "charlie"]);
    expect(container.querySelector(".status-card__state")).toBeNull();
    expect(buttons(card("alpha"))).toEqual([]);
  });

  it("offers one Claim button on a reached milestone, none on one not reached, and starts the claim of that milestone", async () => {
    const { card, container, start } = await show({ unlocked: { alpha: at } });
    expect(buttons(card("alpha"))).toEqual(["Claim Alpha"]);
    expect(buttons(card("bravo"))).toEqual([]);
    expect(
      card("bravo")?.querySelector(".status-card__state")?.textContent,
    ).toBe("Not yet");
    await act(async () =>
      container
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(start).toHaveBeenCalledExactlyOnceWith("alpha");
  });

  it("shows a claim under way by its state and one way to look at it, in place of Claim", async () => {
    const claim = claimAt("pending", { milestoneId: "alpha" });
    const { card, container, review } = await show({
      claims: { alpha: claim },
      unlocked: { alpha: at },
    });
    expect(
      card("alpha")?.querySelector(".status-card__state")?.textContent,
    ).toBe("Sent");
    expect(buttons(card("alpha"))).toEqual(["View claim"]);
    await act(async () =>
      container
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(review).toHaveBeenCalledExactlyOnceWith(claim.id);
  });

  it("says a claim that failed or expired did, in the tone of trouble, and offers Claim again", async () => {
    for (const [state, word] of [
      ["failed", "Failed"],
      ["expired", "Expired"],
    ] as const) {
      const { card } = await show({
        claims: { alpha: claimAt(state, { milestoneId: "alpha" }) },
        unlocked: { alpha: at },
      });
      expect(buttons(card("alpha"))).toEqual(["Claim Alpha"]);
      expect(
        card("alpha")?.querySelector(".status-card__state")?.textContent,
      ).toBe(word);
      expect(
        card("alpha")?.querySelector(".status-card")?.getAttribute("data-tone"),
      ).toBe("problem");
      document.body.replaceChildren();
    }
  });

  it("marks a claim as done, under way or in trouble by its tone, never by colour alone", async () => {
    const tones = async (state: GameClaim["state"]) => {
      const { card } = await show({
        claims: { alpha: claimAt(state, { milestoneId: "alpha" }) },
        unlocked: { alpha: at },
      });
      const found = card("alpha")?.querySelector(".status-card");
      document.body.replaceChildren();
      return found?.getAttribute("data-tone");
    };
    expect(await tones("complete")).toBe("done");
    expect(await tones("pending")).toBe("waiting");
    expect(await tones("awaiting-signature")).toBe("waiting");
  });

  it("folds how a milestone is known: only what was reached, and the replay note only for one declared replay-verifiable", async () => {
    const { card } = await show({ unlocked: { alpha: at } });
    const reached = card("alpha")?.querySelector("details");
    expect(reached?.open).toBe(false);
    expect(reached?.textContent).toContain(
      "Reported by the game on 2026-10-05",
    );
    expect(card("bravo")?.querySelector("details")?.textContent).toContain(
      "replay a run",
    );
    expect(card("charlie")?.querySelector("details")).toBeNull();
  });
});
