import {
  button,
  buttonMatching,
  click,
  settle,
  textOf,
} from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { byName } from "./support/find.ts";
import {
  apiError,
  defining,
  fakeApi,
  listing,
  step,
} from "./support/fake-api.ts";
import { panel } from "./support/panel.tsx";

describe("the log, the milestones and following a step", () => {
  const loaded = (...steps: ReturnType<typeof step>[]) =>
    fakeApi({ list: vi.fn(async () => listing(steps)) });

  it("shows who built and who sent each step, newest first, and reopens one on request", async () => {
    const older = step({
      id: "11111111-1111-4111-8111-111111111111",
      state: "complete",
      submittedBy: "Grace",
      toSign: null,
    });
    const newer = defining({
      id: "22222222-2222-4222-8222-222222222222",
      createdBy: null,
    });
    const container = await panel(loaded(older, newer));
    await settle(() => expect(textOf(container)).toContain("built by Ada"));
    const items = [
      ...container.querySelectorAll('ul[aria-label="Steps taken"] li'),
    ];
    expect(items[0]?.textContent).toContain("Define milestone first-win");
    expect(items[0]?.textContent).toContain("an account that no longer exists");
    expect(items[1]?.textContent).toContain("sent by Grace");
    await click(buttonMatching(items[0] as HTMLElement, /Details/u));
    expect(
      container.querySelector('[data-testid="step-review"]'),
    ).not.toBeNull();
  });

  it("says the log is empty, and that nothing is recorded for pausing", async () => {
    const container = await panel();
    expect(textOf(container)).toContain("Nothing has been done to this game");
    expect(
      container.querySelector('[data-testid="pause-status"]')?.textContent,
    ).toContain("No pause or resume");
  });

  it("shows the last pause that took effect, and a milestone defined on the contract as defined with no way to define it again", async () => {
    const container = await panel(
      loaded(
        step({ state: "complete", submittedBy: "Grace", toSign: null }),
        defining({
          id: "33333333-3333-4333-8333-333333333333",
          state: "complete",
          toSign: null,
        }),
      ),
    );
    await settle(() =>
      expect(textOf(container)).toContain("claims paused by Grace"),
    );
    const row = container.querySelector('[data-milestone="first-win"]');
    expect(row?.textContent).toContain("Defined");
    expect(byName(container, "Define First win")).toBeNull();
    expect(byName(container, "Define Streak")).not.toBeNull();
    expect(
      container.querySelector('[data-milestone="streak"]')?.textContent,
    ).toContain("Not defined");
  });

  it("says a milestone being defined is waiting for the network, and a resumed claim as resumed", async () => {
    const container = await panel(
      loaded(
        defining({ state: "pending", toSign: null }),
        step({
          id: "44444444-4444-4444-8444-444444444444",
          state: "complete",
          submittedBy: "Grace",
          summary: { ...step().summary, paused: false },
          toSign: null,
        }),
      ),
    );
    await settle(() => expect(textOf(container)).toContain("Sent, waiting"));
    expect(textOf(container)).toContain("claims resumed by Grace");
  });

  it("says a step that has waited longer than expected is delayed, and that it has not failed, in the log and in its details", async () => {
    const container = await panel(
      loaded(
        defining({
          delayed: true,
          sentAt: "2026-10-16T11:00:00.000Z",
          state: "pending",
          toSign: null,
        }),
      ),
    );
    await settle(() => expect(textOf(container)).toContain("Sent, delayed"));
    expect(textOf(container)).not.toContain("Sent, waiting");
    expect(
      container.querySelector("[data-delayed='true']")?.textContent,
    ).toContain("Sent, delayed");
    await click(button(container, "Details"));
    const review = container.querySelector('[data-testid="step-review"]');
    expect(review?.textContent).toContain("It has not failed");
    expect(review?.textContent).not.toContain("Failed");
  });

  it("says a confirmed step is delayed too, and shows a settled or ordinary step as it is, whatever the flag", async () => {
    const container = await panel(
      loaded(
        defining({ delayed: true, state: "confirmed", toSign: null }),
        step({
          id: "44444444-4444-4444-8444-444444444444",
          delayed: true,
          state: "complete",
          toSign: null,
        }),
      ),
    );
    await settle(() =>
      expect(textOf(container)).toContain("Confirmed, delayed"),
    );
    expect(textOf(container)).toContain("Complete");
    expect(textOf(container)).not.toContain("Complete, delayed");
    expect(
      container.querySelector("[data-delayed='true']")?.textContent,
    ).toContain("Confirmed, delayed");
  });

  it("looks again at a step that is not over until it is, and then stops", async () => {
    const pending = step({ state: "pending", toSign: null });
    const refresh = vi
      .fn()
      .mockResolvedValueOnce({
        status: "ok",
        step: { ...pending, state: "confirmed" },
      })
      .mockResolvedValue({
        status: "ok",
        step: { ...pending, state: "complete" },
      });
    const container = await panel(
      fakeApi({
        list: vi
          .fn()
          .mockResolvedValueOnce(listing([pending]))
          .mockResolvedValue(listing([{ ...pending, state: "complete" }])),
        refresh,
      }),
      { pollMs: 10 },
    );
    await settle(() => expect(textOf(container)).toContain("Complete"));
    const calls = refresh.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(refresh.mock.calls.length).toBe(calls);
  });

  it("keeps going when a look fails or is refused", async () => {
    const pending = step({ state: "pending", toSign: null });
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(apiError("network"))
      .mockResolvedValueOnce({ reason: "chain-unavailable", status: "refused" })
      .mockResolvedValue({
        status: "ok",
        step: { ...pending, state: "complete" },
      });
    const container = await panel(
      fakeApi({
        list: vi
          .fn()
          .mockResolvedValueOnce(listing([pending]))
          .mockResolvedValue(listing([{ ...pending, state: "complete" }])),
        refresh,
      }),
      { pollMs: 10 },
    );
    await settle(() => expect(textOf(container)).toContain("Complete"));
  });

  it("shows only a pause that took effect as the last one, not a pause still being sent", async () => {
    const container = await panel(
      loaded(
        step({ state: "complete", submittedBy: "Grace", toSign: null }),
        step({
          id: "55555555-5555-4555-8555-555555555555",
          state: "pending",
          summary: { ...step().summary, paused: false },
          toSign: null,
        }),
      ),
    );
    await settle(() =>
      expect(textOf(container)).toContain("claims paused by Grace"),
    );
    expect(textOf(container)).not.toContain("claims resumed by");
  });

  it("says when the log could not be loaded", async () => {
    const container = await panel(
      fakeApi({
        list: vi.fn(async () => {
          throw apiError("network");
        }),
      }),
    );
    await settle(() =>
      expect(textOf(container)).toContain("could not be reached"),
    );
  });
});
