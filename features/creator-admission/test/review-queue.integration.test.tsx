import { ApiError } from "@frostbite/client-http";
import { creatorReviewHref } from "@frostbite/shared/creator-admission";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import type { CreatorReviewApi } from "../src/client/review-api.ts";
import type { ReviewClientServices } from "../src/client/services.ts";
import { ReviewQueue } from "../src/ui/review-queue.tsx";
import {
  emptyCounts,
  queueItem,
  queuePage,
} from "./support/review-fixtures.ts";
import { button, choose, click, mount } from "./support/mount.ts";

type QueueMock = Mock<CreatorReviewApi["queue"]>;

function services(queue: QueueMock): ReviewClientServices {
  return { api: { queue, read: vi.fn() } };
}

function fake(): QueueMock {
  return vi.fn<CreatorReviewApi["queue"]>();
}

let unmount: (() => Promise<void>) | null = null;
async function show(queue: QueueMock) {
  const view = await mount(<ReviewQueue services={services(queue)} />);
  unmount = view.unmount;
  return view.container;
}

afterEach(async () => {
  await unmount?.();
  unmount = null;
});

describe("creator review queue", () => {
  it("lists the waiting applications with a way in and the size of every group", async () => {
    const ada = queueItem({ displayName: "Ada Maker", submissionNumber: 2 });
    const queue = fake().mockResolvedValue({
      ...queuePage([ada]),
      counts: { active: 4, all: 9, finished: 2, "needs-review": 3 },
    });
    const container = await show(queue);
    expect(queue).toHaveBeenCalledWith(
      { cursor: null, group: "needs-review", sort: "oldest" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(button(container, "Needs review").textContent).toContain("3");
    expect(button(container, "All").textContent).toContain("9");
    expect(button(container, "Approved or paused").textContent).toContain("4");
    expect(button(container, "Finished").textContent).toContain("2");
    const link = container.querySelector(
      `a[href="${creatorReviewHref(ada.applicationId)}"]`,
    );
    expect(link?.getAttribute("aria-label")).toBe(
      "Open Ada Maker, submission 2",
    );
    expect(container.textContent).toContain("Submission 2, sent 2026-10-10");
  });

  it("says plainly that a group is empty once it is known to be", async () => {
    const container = await show(fake().mockResolvedValue(queuePage([])));
    expect(container.textContent).toContain("Nothing is waiting for review.");
  });

  it("does not call a list empty while it is still loading", async () => {
    const container = await show(fake().mockReturnValue(new Promise(() => {})));
    expect(container.textContent).toContain("Loading applications…");
    expect(container.textContent).not.toContain("Nothing is waiting");
  });

  it("asks again with the chosen group and order", async () => {
    const queue = fake().mockResolvedValue(queuePage([queueItem()]));
    const container = await show(queue);
    await click(button(container, "Finished"));
    expect(queue).toHaveBeenLastCalledWith(
      { cursor: null, group: "finished", sort: "oldest" },
      expect.anything(),
    );
    const select = container.querySelector("select");
    if (select === null) throw new Error("Expected the sort control");
    await choose(select, "name");
    expect(queue).toHaveBeenLastCalledWith(
      { cursor: null, group: "finished", sort: "name" },
      expect.anything(),
    );
  });

  it("loads the next page after the last row shown and stops when there is none", async () => {
    const first = queueItem({ displayName: "First Maker" });
    const second = queueItem({ displayName: "Second Maker" });
    const queue = fake()
      .mockResolvedValueOnce(queuePage([first], "cursor-two"))
      .mockResolvedValueOnce(queuePage([second], null));
    const container = await show(queue);
    await click(button(container, "Load more applications"));
    expect(queue).toHaveBeenLastCalledWith({
      cursor: "cursor-two",
      group: "needs-review",
      sort: "oldest",
    });
    expect(container.textContent).toContain("First Maker");
    expect(container.textContent).toContain("Second Maker");
    expect(container.textContent).not.toContain("Load more applications");
  });

  it("drops later pages when the group changes", async () => {
    const queue = fake()
      .mockResolvedValueOnce(queuePage([queueItem({ displayName: "A" })], "c"))
      .mockResolvedValueOnce(queuePage([queueItem({ displayName: "B" })]))
      .mockResolvedValue(queuePage([queueItem({ displayName: "C" })]));
    const container = await show(queue);
    await click(button(container, "Load more applications"));
    await click(button(container, "All"));
    expect(container.textContent).toContain("C");
    expect(container.textContent).not.toContain("Load more applications");
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });

  it("offers a retry when the first page cannot be loaded, and recovers", async () => {
    const queue = fake()
      .mockRejectedValueOnce(new ApiError("network", null, "offline"))
      .mockResolvedValue(queuePage([queueItem({ displayName: "Back Again" })]));
    const container = await show(queue);
    expect(container.textContent).toContain(
      "The applications could not be loaded.",
    );
    await click(button(container, "Retry"));
    expect(container.textContent).toContain("Back Again");
    expect(container.textContent).not.toContain("could not be loaded");
  });

  it("keeps what was loaded when asking for more fails, and lets the reviewer dismiss it", async () => {
    const queue = fake()
      .mockResolvedValueOnce(
        queuePage([queueItem({ displayName: "Kept" })], "c"),
      )
      .mockRejectedValueOnce(new ApiError("internal_error", 500, "boom"));
    const container = await show(queue);
    await click(button(container, "Load more applications"));
    expect(container.textContent).toContain("Kept");
    expect(container.textContent).toContain("The server had a problem.");
    await click(button(container, "Dismiss and try again"));
    expect(container.textContent).not.toContain("The server had a problem.");
  });

  it("shows counts of zero until the first page arrives", async () => {
    const container = await show(fake().mockReturnValue(new Promise(() => {})));
    expect(button(container, "All").textContent).toBe(`All${emptyCounts.all}`);
  });
});
