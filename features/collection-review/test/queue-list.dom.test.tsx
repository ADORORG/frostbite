import { button, click, mount, textOf } from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { QueueList } from "../src/ui/components/queue-list.tsx";
import type { LoadedResource } from "../src/ui/hooks/use-resource.ts";
import { queueItem } from "./support/fixtures.ts";

type Queue = LoadedResource<{ items: ReturnType<typeof queueItem>[] }>;

const resource = (state: Queue["state"], reload = () => undefined): Queue => ({
  reload,
  replace: () => undefined,
  state,
});
const failure = { kind: "temporary", message: "x", retryable: true } as const;

describe("queue list", () => {
  it("says it is loading, which is not the same as empty", async () => {
    const container = await mount(
      <QueueList list={resource({ status: "loading" })} />,
    );
    expect(textOf(container)).toContain("Loading submissions…");
    expect(textOf(container)).not.toContain("Nothing here");
  });

  it("says plainly when nothing is waiting", async () => {
    const container = await mount(
      <QueueList list={resource({ data: { items: [] }, status: "ready" })} />,
    );
    expect(textOf(container)).toContain("Nothing here right now.");
  });

  it("shows each submission with its collection, number, state, and a link that names it", async () => {
    const second = queueItem("under-review", {
      collectionName: "Second light",
      sequence: 2,
    });
    const container = await mount(
      <QueueList
        list={resource({
          data: { items: [queueItem(), second] },
          status: "ready",
        })}
      />,
    );
    expect(textOf(container)).toContain("Second light");
    expect(textOf(container)).toContain("Submission 2");
    expect(textOf(container)).toContain("In review");
    const link = container.querySelector(
      `a[href="/admin/collection-reviews/${second.id}"]`,
    );
    expect(link?.textContent).toBe("Open Second light, submission 2");
    expect(
      container.querySelectorAll('ul[aria-label="Submissions"] li'),
    ).toHaveLength(2);
  });

  it("reports a failed first load with a retry", async () => {
    const reload = vi.fn();
    const container = await mount(
      <QueueList
        list={resource({ data: null, failure, status: "error" }, reload)}
      />,
    );
    expect(textOf(container)).toContain("The submissions could not be loaded.");
    await click(button(container, "Retry"));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("keeps showing what was loaded when a refresh fails", async () => {
    const container = await mount(
      <QueueList
        list={resource({
          data: { items: [queueItem()] },
          failure,
          status: "error",
        })}
      />,
    );
    expect(textOf(container)).toContain(
      "Could not refresh. Showing what was loaded earlier.",
    );
    expect(textOf(container)).toContain("First light");
  });
});
