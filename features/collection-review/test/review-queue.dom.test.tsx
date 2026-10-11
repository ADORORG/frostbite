import { ApiError } from "@ador/client-http";
import { chooseOption, mount, settle, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { ReviewQueue } from "../src/ui/review-queue.tsx";
import { fakeReview } from "./support/fake-api.ts";
import { detailOf, queueItem } from "./support/fixtures.ts";

const waiting = queueItem("submitted", { collectionName: "Waiting light" });
const inReview = queueItem("under-review", { collectionName: "Busy light" });
const approved = queueItem("approved", { collectionName: "Done light" });
const closed = queueItem("rejected", { collectionName: "Closed light" });

describe("review queue", () => {
  it("opens on what needs a reviewer and lists those submissions only", async () => {
    const fake = fakeReview(detailOf(), [waiting, inReview, approved, closed]);
    const container = await mount(<ReviewQueue services={fake.services} />);
    await settle(() => expect(textOf(container)).toContain("Waiting light"));
    expect(textOf(container)).toContain("Busy light");
    expect(textOf(container)).not.toContain("Done light");
    expect(fake.api.queue.mock.calls[0]?.[0]).toEqual([
      "submitted",
      "under-review",
    ]);
    expect(container.querySelector("h2")?.textContent).toBe("Needs review");
  });

  it("reads another group when it is chosen, and titles the panel with it", async () => {
    const fake = fakeReview(detailOf(), [waiting, approved, closed]);
    const container = await mount(<ReviewQueue services={fake.services} />);
    await settle(() => expect(textOf(container)).toContain("Waiting light"));
    await chooseOption(container, "finished");
    await settle(() => expect(textOf(container)).toContain("Closed light"));
    expect(textOf(container)).not.toContain("Waiting light");
    expect(container.querySelector("h2")?.textContent).toBe("Finished");
    expect(fake.api.queue.mock.calls.at(-1)?.[0]).toEqual([
      "changes-requested",
      "rejected",
      "revoked",
    ]);
  });

  it("says nothing is waiting when a group is empty", async () => {
    const container = await mount(
      <ReviewQueue services={fakeReview().services} />,
    );
    await settle(() =>
      expect(textOf(container)).toContain("Nothing here right now."),
    );
  });

  it("reports a failed load with the same words the rest of the page uses", async () => {
    const fake = fakeReview();
    fake.api.queue.mockRejectedValue(new ApiError("network", null, "x"));
    const container = await mount(<ReviewQueue services={fake.services} />);
    await settle(() =>
      expect(textOf(container)).toContain(
        "The submissions could not be loaded.",
      ),
    );
  });
});
