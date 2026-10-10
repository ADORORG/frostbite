import { ApiError } from "@ador/client-http";
import { button, click, mount, settle, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { ActivityList } from "../src/ui/components/activity-list.tsx";
import { CreatorStanding } from "../src/ui/components/creator-standing.tsx";
import { ActivitySurface } from "../src/ui/activity-surface.tsx";
import { ReviewActivity } from "../src/ui/review-activity.tsx";
import { fakeReview } from "./support/fake-api.ts";
import { activityItem, detailOf } from "./support/fixtures.ts";

const log = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    activityItem({
      collectionName: `Light ${String(index + 1)}`,
      createdAt: `2026-10-10T12:${String(59 - index).padStart(2, "0")}:00.000Z`,
    }),
  );

describe("activity list", () => {
  it("states each event as a sentence: who, what, which submission, when, and the state it left", async () => {
    const [item] = log(1);
    if (item === undefined) throw new Error("no item");
    const container = await mount(<ActivityList items={[item]} />);
    const text = textOf(container);
    expect(text).toContain(
      "Rita Reviewer started review of Light 1, submission 1",
    );
    expect(text).toContain("2026-10-10 12:59 UTC · reviewer-started-review");
    expect(text).toContain("In review");
    const link = container.querySelector(
      `a[href="/admin/collection-reviews/${item.submissionId}"]`,
    );
    expect(link?.textContent).toBe("Open Light 1, submission 1");
  });

  it("says a submission was submitted, approved, or had changes requested, in the past tense", async () => {
    const items = [
      activityItem({
        action: "submit",
        actorName: "Creator",
        nextState: "submitted",
        previousState: null,
      }),
      activityItem({
        action: "approve",
        nextState: "approved",
        previousState: "under-review",
      }),
      activityItem({
        action: "request-changes",
        nextState: "changes-requested",
        previousState: "under-review",
      }),
    ];
    const text = textOf(await mount(<ActivityList items={items} />));
    expect(text).toContain("Creator submitted First light");
    expect(text).toContain("Rita Reviewer approved First light");
    expect(text).toContain("requested changes on First light");
  });
});

describe("creator standing", () => {
  it("is calm for an approved creator, and warns before an approval for anyone else", async () => {
    expect(textOf(await mount(<CreatorStanding state="approved" />))).toBe(
      "Creator standing: approved",
    );
    for (const state of ["suspended", "revoked", "draft"] as const)
      expect(textOf(await mount(<CreatorStanding state={state} />))).toContain(
        `Creator standing: ${state}. An approval will be refused.`,
      );
    expect(textOf(await mount(<CreatorStanding state={null} />))).toContain(
      "never applied",
    );
  });
});

describe("activity page", () => {
  it("shows the newest page, then older pages one click at a time, with nothing repeated", async () => {
    const fake = fakeReview(detailOf(), [], log(5));
    const container = await mount(<ReviewActivity services={fake.services} />);
    await settle(() => expect(textOf(container)).toContain("Light 1"));
    expect(
      container.querySelectorAll('ol[aria-label="Review activity"] > li'),
    ).toHaveLength(2);
    await click(button(container, "Load older activity"));
    await settle(() =>
      expect(
        container.querySelectorAll('ol[aria-label="Review activity"] > li'),
      ).toHaveLength(4),
    );
    await click(button(container, "Load older activity"));
    await settle(() =>
      expect(
        container.querySelectorAll('ol[aria-label="Review activity"] > li'),
      ).toHaveLength(5),
    );
    expect(button(container, "Load older activity")).toBeNull();
    const names = [
      ...container.querySelectorAll(
        'ol[aria-label="Review activity"] > li strong',
      ),
    ].map((node) => node.textContent);
    expect(names).toHaveLength(5);
    expect(
      fake.api.activity.mock.calls.map(([cursor]) => cursor === null),
    ).toEqual([true, false, false]);
  });

  it("offers no older page when the whole log fits on one", async () => {
    const container = await mount(
      <ReviewActivity services={fakeReview(detailOf(), [], log(2)).services} />,
    );
    await settle(() => expect(textOf(container)).toContain("Light 2"));
    expect(button(container, "Load older activity")).toBeNull();
  });

  it("says nothing has happened yet, which is not the same as loading", async () => {
    const fake = fakeReview();
    let arrive: (value: { items: never[]; nextCursor: null }) => void = () =>
      undefined;
    fake.api.activity.mockReturnValue(
      new Promise((resolve) => {
        arrive = resolve;
      }),
    );
    const container = await mount(<ReviewActivity services={fake.services} />);
    expect(textOf(container)).toContain("Loading activity…");
    expect(textOf(container)).not.toContain("Nothing has happened yet.");
    arrive({ items: [], nextCursor: null });
    await settle(() =>
      expect(textOf(container)).toContain("Nothing has happened yet."),
    );
  });

  it("reports a failed first load with a retry, and a failed older page without losing what is shown", async () => {
    const fake = fakeReview(detailOf(), [], log(4));
    fake.api.activity.mockRejectedValueOnce(new ApiError("network", null, "x"));
    const container = await mount(<ReviewActivity services={fake.services} />);
    await settle(() =>
      expect(textOf(container)).toContain("The activity could not be loaded."),
    );
    await click(button(container, "Retry"));
    await settle(() => expect(textOf(container)).toContain("Light 1"));
    fake.api.activity.mockRejectedValueOnce(new ApiError("network", null, "x"));
    await click(button(container, "Load older activity"));
    await settle(() =>
      expect(textOf(container)).toContain("could not reach the server"),
    );
    expect(textOf(container)).toContain("Light 1");
    await click(button(container, "Dismiss and try again"));
    await click(button(container, "Load older activity"));
    await settle(() => expect(textOf(container)).toContain("Light 3"));
  });

  it("starts the list again from the top when it is reloaded after older pages were shown", async () => {
    const fake = fakeReview(detailOf(), [], log(5));
    fake.api.activity.mockRejectedValueOnce(new ApiError("network", null, "x"));
    const container = await mount(<ReviewActivity services={fake.services} />);
    await settle(() => expect(button(container, "Retry")).not.toBeNull());
    await click(button(container, "Retry"));
    await settle(() =>
      expect(
        container.querySelectorAll('ol[aria-label="Review activity"] > li'),
      ).toHaveLength(2),
    );
  });
});

describe("activity surface", () => {
  it("frames the log in the platform shell and says events cannot be changed", async () => {
    const container = await mount(<ActivitySurface navigation={[]} />);
    expect(container.querySelector("h1")?.textContent).toBe("Review activity");
    expect(textOf(container)).toContain("Events cannot be changed or removed.");
  });
});
