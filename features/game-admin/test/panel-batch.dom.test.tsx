import {
  button,
  chooseFiles,
  click,
  mount,
  settle,
  textOf,
} from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { GameAdminPanel } from "../src/ui/game-admin-panel.tsx";
import { defining, fakeApi, listing } from "./support/fake-api.ts";
import { enterWallet } from "./support/panel.tsx";
import { info } from "./support/fixtures.ts";

const good = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="${fill}"/></svg>`;
// A role attribute is on no allow-list, so a drawing exported with one is refused before any step is started.
const withRole = good("#00ff00").replace("<svg ", '<svg role="img" ');
const file = (name: string, text: string) =>
  new File([text], name, { type: "image/svg+xml" });
const stepFor = (
  milestoneId: string,
  state: "awaiting-signature" | "complete",
) =>
  defining({
    // One step for one milestone, whatever state it is in, as the log keeps it.
    id: `${milestoneId}-step`,
    state,
    summary: { ...defining().summary, milestoneId },
  });
const arcade = () => {
  const found = info()[0];
  if (found === undefined) throw new Error("no game");
  return found;
};
const show = async (api = fakeApi()) => {
  const container = await mount(
    <GameAdminPanel api={api} game={arcade()} pollMs={5} />,
  );
  await settle(() =>
    expect(textOf(container)).toContain("Define many milestones"),
  );
  await enterWallet(container);
  return container;
};

describe("defining many milestones from a folder of drawings", () => {
  it("checks every drawing against the platform's rules first, says which are refused and why, and names files that match nothing", async () => {
    const container = await show();
    await chooseFiles(container, [
      file("first-win.svg", good("#ff0000")),
      file("streak.svg", withRole),
      file("ghost.svg", good("#0000ff")),
    ]);
    expect(textOf(container)).toContain("1 drawing ready");
    expect(textOf(container)).toContain("No milestone matches: ghost.svg.");
    const rows = [...container.querySelectorAll("[data-batch-state]")].map(
      (row) => row.getAttribute("data-batch-state"),
    );
    expect(rows).toEqual(["ready", "refused"]);
    expect(
      container.querySelector('[data-batch-state="refused"] small')
        ?.textContent,
    ).not.toBe("");
    expect(button(container, "Define 1 milestone")).not.toBeNull();
  });

  it("starts the first, waits for it to be signed and seen on the network, then starts the next, each with its own drawing", async () => {
    let log = [] as ReturnType<typeof stepFor>[];
    const start = vi.fn(async ({ action }) => {
      const milestoneId = (action as { milestoneId: string }).milestoneId;
      const started = stepFor(milestoneId, "awaiting-signature");
      log = [...log, started];
      return { resumed: false, status: "started" as const, step: started };
    });
    const api = fakeApi({
      list: vi.fn(async () => listing(log)),
      refresh: vi.fn(async (stepId: string) => {
        const found = log.find(({ id }) => id === stepId);
        if (found === undefined) throw new Error("no such step");
        return { status: "ok" as const, step: found };
      }),
      start,
    });
    const container = await show(api);
    await chooseFiles(container, [
      file("first-win.svg", good("#ff0000")),
      file("streak.svg", good("#00ff00")),
    ]);
    await click(button(container, "Define 2 milestones"));
    await settle(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      action: {
        drawing: good("#ff0000"),
        milestoneId: "first-win",
        operation: "define-milestone",
      },
    });
    // It is waiting to be signed: the second is not started, however long it waits.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(start).toHaveBeenCalledTimes(1);
    // The first is seen on the network; now the second.
    log = [stepFor("first-win", "complete")];
    await settle(() => expect(start).toHaveBeenCalledTimes(2));
    expect(start.mock.calls[1]?.[0]).toMatchObject({
      action: { drawing: good("#00ff00"), milestoneId: "streak" },
    });
  });

  it("leaves a milestone the contract already has out of the batch", async () => {
    const api = fakeApi({
      list: vi.fn(async () => listing([stepFor("first-win", "complete")])),
    });
    const container = await show(api);
    await chooseFiles(container, [
      file("first-win.svg", good("#ff0000")),
      file("streak.svg", good("#00ff00")),
    ]);
    expect(textOf(container)).toContain("1 drawing ready");
    expect(button(container, "Define 1 milestone")).not.toBeNull();
  });

  it("stops at the milestone the platform would not start, says so, shows why, and carries on when continued", async () => {
    let refuse = true;
    const start = vi.fn(async () =>
      refuse
        ? {
            detail: "No confirmed output.",
            reason: "could-not-build" as const,
            status: "refused" as const,
          }
        : {
            resumed: false,
            status: "started" as const,
            step: stepFor("first-win", "awaiting-signature"),
          },
    );
    const container = await show(fakeApi({ start }));
    await chooseFiles(container, [file("first-win.svg", good("#ff0000"))]);
    await click(button(container, "Define 1 milestone"));
    await settle(() =>
      expect(textOf(container)).toContain("Stopped at First win."),
    );
    expect(textOf(container)).toContain(
      "The step could not be built. No confirmed output.",
    );
    expect(start).toHaveBeenCalledTimes(1);
    refuse = false;
    await click(button(container, "Continue"));
    await settle(() => expect(start).toHaveBeenCalledTimes(2));
  });
});
