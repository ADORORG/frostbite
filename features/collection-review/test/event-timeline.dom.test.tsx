import { mount, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { EventTimeline } from "../src/ui/components/event-timeline.tsx";
import { event } from "./support/fixtures.ts";

describe("event timeline", () => {
  it("lists every event in order with who acted, the reason, and the state it led to", async () => {
    const events = [
      event("submit"),
      event("start-review", {
        nextState: "under-review",
        previousState: "submitted",
        reasonCode: "reviewer-started-review",
      }),
    ];
    const container = await mount(<EventTimeline events={events} />);
    const items = [...container.querySelectorAll("li")].map(
      (item) => item.textContent ?? "",
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Submitted by the creator");
    expect(items[1]).toContain("Start review");
    expect(items[1]).toContain("now In review");
    expect(items[1]).toContain(
      `By ${events[1]?.actorUserId} · reviewer-started-review`,
    );
  });

  it("shows what was told to the creator and the private notes only staff may see, each labelled", async () => {
    const container = await mount(
      <EventTimeline
        events={[
          event("request-changes", {
            creatorFeedback: "Add a banner.",
            nextState: "changes-requested",
            privateNotes: "Rights look unclear.",
          }),
        ]}
      />,
    );
    expect(textOf(container)).toContain("Told the creator: Add a banner.");
    expect(textOf(container)).toContain("Private note: Rights look unclear.");
  });

  it("shows neither line when there is nothing to say", async () => {
    const container = await mount(<EventTimeline events={[event("submit")]} />);
    expect(textOf(container)).not.toContain("Told the creator");
    expect(textOf(container)).not.toContain("Private note");
  });
});
