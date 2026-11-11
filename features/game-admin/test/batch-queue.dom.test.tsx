import type { GameAdminAction, GameAdminStep } from "@frostbite/shared/games";
import { button, click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { act, useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Starting } from "../src/ui/starting.ts";
import { useBatchQueue, type BatchItem } from "../src/ui/use-batch-queue.ts";
import { defining } from "./support/fake-api.ts";

const items: readonly BatchItem[] = [
  { drawing: "<one/>", milestoneId: "first-win" },
  { drawing: "<two/>", milestoneId: "streak" },
  { drawing: "<three/>", milestoneId: "flawless" },
];
const stepFor = (milestoneId: string, state: GameAdminStep["state"]) =>
  defining({
    id: `${milestoneId}-${state}`,
    state,
    summary: { ...defining().summary, milestoneId },
  });

// The hook over a log the test controls, the way the panel gives it: the test moves the log along (a step is signed, seen on the
// network, fails) and sees what the queue asked for.
// What the test can do to the page the hook sits in: move the log along, or hand the hook a new `ask` (the panel makes one again
// whenever the signer's details change).
type Swap = () => Promise<void>;
type Move = (to: {
  starting?: Starting | null;
  steps?: readonly GameAdminStep[];
}) => Promise<void>;
const control: { move: Move; swap: Swap } = {
  move: () => Promise.resolve(),
  swap: () => Promise.resolve(),
};
const move: Move = (to) => control.move(to);
const swapAsk: Swap = () => control.swap();
function Harness({
  ask,
  chosen,
  initial = [],
}: {
  readonly ask: (action: GameAdminAction) => Promise<void>;
  readonly chosen: readonly BatchItem[];
  readonly initial?: readonly GameAdminStep[];
}) {
  const [steps, setSteps] = useState(initial);
  const [starting, setStarting] = useState<Starting | null>(null);
  const [current, setCurrent] = useState(() => ask);
  useEffect(() => {
    control.swap = async () => {
      await act(() =>
        setCurrent(() => (action: GameAdminAction) => ask(action)),
      );
    };
    control.move = async (to) => {
      await act(() => {
        if (to.steps !== undefined) setSteps(to.steps);
        if (to.starting !== undefined) setStarting(to.starting);
      });
    };
  }, [ask]);
  const queue = useBatchQueue({
    admin: { dismiss: () => setStarting(null), starting, steps },
    ask: current,
  });
  return (
    <div>
      <p>{`running:${String(queue.running)} stopped:${queue.stoppedAt ?? "-"}`}</p>
      <button onClick={() => queue.start(chosen)} type="button">
        start
      </button>
      <button onClick={queue.pause} type="button">
        pause
      </button>
      <button onClick={queue.resume} type="button">
        resume
      </button>
    </div>
  );
}
const asked = (ask: ReturnType<typeof vi.fn>) =>
  ask.mock.calls.map(
    ([action]) => (action as { milestoneId: string }).milestoneId,
  );
const show = async (
  ask = vi.fn(async () => undefined),
  initial: readonly GameAdminStep[] = [],
) => {
  const container = await mount(
    <Harness ask={ask} chosen={items} initial={initial} />,
  );
  return { ask, container };
};

describe("walking a batch of definitions", () => {
  it("asks for one at a time, the next only when the last has completed, and ends when all are defined", async () => {
    const { ask, container } = await show();
    await click(button(container, "start"));
    await settle(() => expect(asked(ask)).toEqual(["first-win"]));
    expect(ask).toHaveBeenCalledWith({
      drawing: "<one/>",
      milestoneId: "first-win",
      operation: "define-milestone",
    });
    // Waiting to be signed, then sent: nothing more is asked for while a step is under way.
    await move({ steps: [stepFor("first-win", "awaiting-signature")] });
    await move({ steps: [stepFor("first-win", "pending")] });
    expect(asked(ask)).toEqual(["first-win"]);
    await move({ steps: [stepFor("first-win", "complete")] });
    await settle(() => expect(asked(ask)).toEqual(["first-win", "streak"]));
    await move({
      steps: [stepFor("first-win", "complete"), stepFor("streak", "complete")],
    });
    await settle(() => expect(asked(ask)).toHaveLength(3));
    await move({
      steps: items.map(({ milestoneId }) => stepFor(milestoneId, "complete")),
    });
    await settle(() => expect(textOf(container)).toContain("running:false"));
    expect(asked(ask)).toEqual(["first-win", "streak", "flawless"]);
  });

  it("does not ask twice for a milestone whose step is not in the log yet", async () => {
    const { ask } = await show();
    await click(button(document.body, "start"));
    await settle(() => expect(ask).toHaveBeenCalledTimes(1));
    // The log has not caught up (nothing moved), and the page renders again meanwhile.
    await move({ steps: [] });
    await move({ starting: null });
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("does not ask again when the page hands it a new way to ask before the log has caught up", async () => {
    const { ask, container } = await show();
    await click(button(container, "start"));
    await settle(() => expect(ask).toHaveBeenCalledTimes(1));
    await swapAsk();
    await swapAsk();
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("skips the milestones the contract already has, so choosing the drawings again after a reload carries on where it stopped", async () => {
    const { ask, container } = await show(
      vi.fn(async () => undefined),
      [stepFor("first-win", "complete"), stepFor("streak", "complete")],
    );
    await click(button(container, "start"));
    await settle(() => expect(asked(ask)).toEqual(["flawless"]));
  });

  it("waits for a step still waiting to be signed, left from before a reload, before it asks for any", async () => {
    const { ask, container } = await show(
      vi.fn(async () => undefined),
      [stepFor("first-win", "awaiting-signature")],
    );
    await click(button(container, "start"));
    await move({});
    expect(ask).not.toHaveBeenCalled();
    await move({ steps: [stepFor("first-win", "complete")] });
    await settle(() => expect(asked(ask)).toEqual(["streak"]));
  });

  it("stops at a milestone whose step failed, and asks for it again when continued", async () => {
    const { ask, container } = await show();
    await click(button(container, "start"));
    await settle(() => expect(asked(ask)).toEqual(["first-win"]));
    await move({ steps: [stepFor("first-win", "failed")] });
    await settle(() =>
      expect(textOf(container)).toContain("running:false stopped:first-win"),
    );
    expect(asked(ask)).toEqual(["first-win"]);
    await click(button(container, "resume"));
    await settle(() => expect(asked(ask)).toEqual(["first-win", "first-win"]));
    expect(textOf(container)).toContain("stopped:-");
  });

  it("stops when the platform refuses to start a step, and says where", async () => {
    const { ask, container } = await show();
    await click(button(container, "start"));
    await settle(() => expect(asked(ask)).toEqual(["first-win"]));
    await move({ starting: { failure: "No confirmed output.", label: "x" } });
    await settle(() =>
      expect(textOf(container)).toContain("running:false stopped:first-win"),
    );
    expect(asked(ask)).toEqual(["first-win"]);
  });

  it("asks for nothing more once paused, and for nothing when there is nothing to define", async () => {
    const { ask, container } = await show();
    await click(button(container, "start"));
    await settle(() => expect(asked(ask)).toEqual(["first-win"]));
    await click(button(container, "pause"));
    await move({ steps: [stepFor("first-win", "complete")] });
    expect(asked(ask)).toEqual(["first-win"]);
    expect(textOf(container)).toContain("running:false");
  });
});
