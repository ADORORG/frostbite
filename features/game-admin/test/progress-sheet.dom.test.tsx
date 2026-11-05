import { button, click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { TemplatesPanel } from "../src/ui/templates-panel.tsx";
import { apiError, fakeApi, publishing } from "./support/fake-api.ts";
import { byName } from "./support/find.ts";
import { enterWallet } from "./support/panel.tsx";
import { sheet, sheetTitle, slowStart } from "./support/slow-start.ts";

describe("an action pressed on the templates page", () => {
  const open = async () => {
    const slow = slowStart();
    const container = await mount(
      <TemplatesPanel api={fakeApi({ start: slow.start })} />,
    );
    await settle(() =>
      expect(byName(container, "Publish game-rewards@1.0.0")).not.toBeNull(),
    );
    await enterWallet(container);
    return { container, slow };
  };

  it("shows at once that it is being prepared, in the sheet and on the button that was pressed", async () => {
    const { container } = await open();
    expect(sheet(container)?.hasAttribute("open")).toBe(false);
    await click(byName(container, "Publish game-rewards@1.0.0"));
    expect(sheet(container)?.hasAttribute("open")).toBe(true);
    expect(sheetTitle(container)).toBe("Publish template game-rewards@1.0.0");
    const status = sheet(container)?.querySelector('[role="status"]');
    expect(status?.textContent).toContain("Preparing the step…");
    expect(status?.textContent).toContain(
      "Nothing is sent, and nothing is signed yet.",
    );
    expect(sheet(container)?.querySelector(".spinner")).not.toBeNull();
    const pressed = byName(container, "Publish game-rewards@1.0.0");
    expect(pressed?.getAttribute("aria-busy")).toBe("true");
    expect(pressed?.disabled).toBe(true);
    expect(pressed?.textContent).toBe("Preparing…");
    // The other template waits: one step is prepared at a time, and it does not pretend to be busy.
    const other = byName(container, "Publish milestone-collectible@1.0.0");
    expect(other?.disabled).toBe(true);
    expect(other?.hasAttribute("aria-busy")).toBe(false);
  });

  it("becomes the step's review, with where it stands, once the platform has built it", async () => {
    const { container, slow } = await open();
    await click(byName(container, "Publish game-rewards@1.0.0"));
    slow.answer({ resumed: false, status: "started", step: publishing() });
    await settle(() =>
      expect(
        container.querySelector('[data-testid="step-review"]'),
      ).not.toBeNull(),
    );
    expect(textOf(sheet(container) ?? container)).not.toContain(
      "Preparing the step…",
    );
    expect(sheetTitle(container)).toBe("Publish template game-rewards@1.0.0");
    const stages = [...container.querySelectorAll(".progress-steps li")].map(
      (item) => item.getAttribute("data-state"),
    );
    expect(stages).toEqual(["done", "active", "pending", "pending", "pending"]);
    expect(
      byName(container, "Sign with your wallet") ??
        button(container, "Send signed transaction"),
    ).not.toBeNull();
  });

  it("says why it could not be started in the sheet, where it was asked, and lets the page go on once closed", async () => {
    const { container, slow } = await open();
    await click(byName(container, "Publish game-rewards@1.0.0"));
    slow.answer({
      detail: "no funds",
      reason: "could-not-build",
      status: "refused",
    });
    await settle(() =>
      expect(
        sheet(container)?.querySelector('[role="alert"]')?.textContent,
      ).toBe("The step could not be built. no funds"),
    );
    expect(sheet(container)?.querySelector(".spinner")).toBeNull();
    // The button is held while the sheet is open, but it no longer says it is working: nothing is. It is free again once closed.
    const held = () => byName(container, "Publish game-rewards@1.0.0");
    expect(held()?.disabled).toBe(true);
    expect(held()?.hasAttribute("aria-busy")).toBe(false);
    expect(held()?.textContent).toBe("Publish");
    await click(
      sheet(container)?.querySelector(".arcade-modal__header button") ?? null,
    );
    expect(sheet(container)?.hasAttribute("open")).toBe(false);
    expect(byName(container, "Publish game-rewards@1.0.0")?.disabled).toBe(
      false,
    );
    expect(
      byName(container, "Publish game-rewards@1.0.0")?.hasAttribute(
        "aria-busy",
      ),
    ).toBe(false);
  });

  it("offers nothing to sign while another action is being prepared, even with a step open behind it", async () => {
    const slow = slowStart();
    const container = await mount(
      <TemplatesPanel
        api={fakeApi({
          start: slow.start,
          templates: vi.fn(async () => ({
            publishable: [
              { id: "game-rewards", version: "1.0.0" },
              { id: "milestone-collectible", version: "1.0.0" },
            ],
            published: [],
            steps: [publishing()],
          })),
        })}
      />,
    );
    await settle(() =>
      expect(
        byName(container, "Publish milestone-collectible@1.0.0"),
      ).not.toBeNull(),
    );
    await enterWallet(container);
    await click(
      byName(container, "Review the step publishing game-rewards@1.0.0"),
    );
    expect(
      sheet(container)?.querySelector(".arcade-modal__footer"),
    ).not.toBeNull();
    await click(byName(container, "Publish milestone-collectible@1.0.0"));
    expect(sheetTitle(container)).toBe(
      "Publish template milestone-collectible@1.0.0",
    );
    expect(sheet(container)?.querySelector(".arcade-modal__footer")).toBeNull();
    expect(container.querySelector('[data-testid="step-review"]')).toBeNull();
  });

  it("names a fault in the platform in the sheet, with its reference, and says nothing was changed", async () => {
    const { container, slow } = await open();
    await click(byName(container, "Publish game-rewards@1.0.0"));
    slow.fail(
      apiError("internal_error", "018f22f2-9c1a-7b21-8c45-0000000000aa"),
    );
    await settle(() =>
      expect(
        sheet(container)?.querySelector('[role="alert"]')?.textContent,
      ).toContain("The platform failed while building the step."),
    );
    expect(sheet(container)?.textContent).toContain(
      "Reference 018f22f2-9c1a-7b21-8c45-0000000000aa",
    );
    expect(sheet(container)?.textContent).toContain("Nothing was changed.");
  });

  it("shows a template with a step in progress as that step, and a published one as published, apart from one not yet published", async () => {
    const container = await mount(
      <TemplatesPanel
        api={fakeApi({
          templates: vi.fn(async () => ({
            publishable: [
              { id: "game-rewards", version: "1.0.0" },
              { id: "milestone-collectible", version: "1.0.0" },
              { id: "third", version: "2.0.0" },
            ],
            published: [
              {
                address: "at-9",
                publishedAt: "2026-10-16T12:00:00.000Z",
                templateRef: "third@2.0.0",
              },
            ],
            steps: [publishing({ state: "pending", toSign: null })],
          })),
        })}
      />,
    );
    await settle(() =>
      expect(container.querySelectorAll("[data-template]")).toHaveLength(3),
    );
    const tiles = [...container.querySelectorAll("[data-template]")];
    const badge = (index: number) =>
      tiles[index]?.querySelector(".arcade-badge")?.textContent;
    expect(badge(0)).toBe("Sent, waiting");
    expect(badge(1)).toBe("Not published");
    expect(badge(2)).toBe("Published");
    expect(tiles[0]?.querySelector("button")?.textContent).toBe("Review step");
    expect(tiles[1]?.querySelector("button")?.textContent).toBe("Publish");
    expect(tiles[2]?.querySelector("button")).toBeNull();
    expect(tiles[2]?.textContent).toContain("at-9");
  });

  it("reopens the step in progress from its tile", async () => {
    const container = await mount(
      <TemplatesPanel
        api={fakeApi({
          templates: vi.fn(async () => ({
            publishable: [{ id: "game-rewards", version: "1.0.0" }],
            published: [],
            steps: [publishing({ state: "pending", toSign: null })],
          })),
        })}
      />,
    );
    await settle(() =>
      expect(
        byName(container, "Review the step publishing game-rewards@1.0.0"),
      ).not.toBeNull(),
    );
    await click(
      byName(container, "Review the step publishing game-rewards@1.0.0"),
    );
    expect(sheetTitle(container)).toBe("Publish template game-rewards@1.0.0");
    expect(
      container
        .querySelector('[data-testid="step-review"]')
        ?.getAttribute("data-state"),
    ).toBe("pending");
  });
});
