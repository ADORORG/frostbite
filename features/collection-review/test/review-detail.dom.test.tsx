import { ApiError } from "@ador/client-http";
import {
  button,
  click,
  fieldByLabel,
  mount,
  settle,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { ReviewDetail } from "../src/ui/review-detail.tsx";
import { fakeReview } from "./support/fake-api.ts";
import { detailOf, reviewSubmission } from "./support/fixtures.ts";

const choose = (container: HTMLElement, label: string) =>
  click(
    [...container.querySelectorAll("label")]
      .find((candidate) => candidate.textContent?.startsWith(label))
      ?.querySelector("input") ?? null,
  );

async function open(
  state: Parameters<typeof reviewSubmission>[0] = "submitted",
) {
  const fake = fakeReview(detailOf(reviewSubmission(state)));
  const container = await mount(
    <ReviewDetail
      services={fake.services}
      submissionId={fake.state.detail.submission.id}
    />,
  );
  await settle(() => expect(textOf(container)).toContain("Dawn"));
  return { container, fake };
}

describe("review detail: loading", () => {
  it("shows the submission with its frozen version, decision form, and history", async () => {
    const { container } = await open();
    expect(container.querySelector("h2")?.textContent).toBe("First light");
    expect(textOf(container)).toContain("Status: Submitted");
    expect(
      container.querySelector('section[aria-label="Submitted version"]'),
    ).not.toBeNull();
    expect(textOf(container)).toContain("What to do");
    expect(textOf(container)).toContain("History");
    expect(
      container.querySelector('a[href="/admin/collection-reviews"]'),
    ).not.toBeNull();
  });

  it("says it is loading first, and offers no decision until the submission has arrived", async () => {
    const fake = fakeReview();
    let arrive: (value: typeof fake.state.detail) => void = () => undefined;
    fake.api.read.mockReturnValue(
      new Promise((resolve) => {
        arrive = resolve;
      }),
    );
    const container = await mount(
      <ReviewDetail
        services={fake.services}
        submissionId={fake.state.detail.submission.id}
      />,
    );
    expect(textOf(container)).toContain("Loading the submission…");
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    arrive(fake.state.detail);
    await settle(() => expect(textOf(container)).toContain("Dawn"));
  });

  it("says a missing submission cannot be found, with no retry", async () => {
    const fake = fakeReview();
    fake.api.read.mockRejectedValue(new ApiError("not_found", 404, "x"));
    const container = await mount(
      <ReviewDetail
        services={fake.services}
        submissionId="018f22f2-9c1a-7b21-8c45-0000000000ff"
      />,
    );
    await settle(() =>
      expect(textOf(container)).toContain(
        "This submission could not be found.",
      ),
    );
    expect(button(container, "Retry")).toBeNull();
  });

  it("offers a retry for a temporary fault", async () => {
    const fake = fakeReview();
    fake.api.read.mockRejectedValueOnce(new ApiError("network", null, "x"));
    const container = await mount(
      <ReviewDetail
        services={fake.services}
        submissionId={fake.state.detail.submission.id}
      />,
    );
    await settle(() => expect(button(container, "Retry")).not.toBeNull());
    await click(button(container, "Retry"));
    await settle(() => expect(textOf(container)).toContain("Dawn"));
  });
});

describe("review detail: deciding", () => {
  it("records a decision, shows the new state and history, and offers the next moves", async () => {
    const { container, fake } = await open();
    await choose(container, "Start review");
    await click(button(container, "Record decision"));
    await settle(() =>
      expect(textOf(container)).toContain("Status: In review"),
    );
    expect(fake.api.decide).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "start-review",
        reasonCode: "reviewer-started-review",
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(textOf(container)).toContain("Rita Reviewer started review of it");
    expect(textOf(container)).toContain("Approve");
    expect(textOf(container)).toContain("Reject");
  });

  it("keeps the images after a decision, because the decision answers without previews", async () => {
    const { container } = await open();
    await choose(container, "Start review");
    await click(button(container, "Record decision"));
    await settle(() =>
      expect(textOf(container)).toContain("Status: In review"),
    );
    expect(
      container.querySelector('img[alt="Cover image for First light"]'),
    ).not.toBeNull();
  });

  it("will not send a decision without the feedback it needs, and says so", async () => {
    const { container, fake } = await open("under-review");
    await choose(container, "Request changes");
    await click(button(container, "Record decision"));
    expect(textOf(container)).toContain("Write what the creator should know");
    expect(fake.api.decide).not.toHaveBeenCalled();
    await typeInto(
      fieldByLabel(container, "Feedback for the creator"),
      "Add a banner.",
    );
    await click(button(container, "Record decision"));
    await settle(() =>
      expect(textOf(container)).toContain("Status: Changes requested"),
    );
    expect(textOf(container)).not.toContain(
      "Write what the creator should know",
    );
    expect(textOf(container)).toContain("Told the creator: Add a banner.");
    expect(textOf(container)).toContain("No further decisions are possible");
  });

  it("retries a lost decision with the same key, and uses a new key once the decision changes", async () => {
    const { container, fake } = await open("under-review");
    fake.api.decide.mockRejectedValueOnce(new ApiError("network", null, "x"));
    await choose(container, "Approve");
    await click(button(container, "Record decision"));
    await settle(() =>
      expect(textOf(container)).toContain("could not reach the server"),
    );
    await click(button(container, "Dismiss and try again"));
    await click(button(container, "Record decision"));
    await settle(() => expect(textOf(container)).toContain("Status: Approved"));
    const keys = fake.api.decide.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it("uses a different key for a different decision", async () => {
    const { container, fake } = await open("under-review");
    fake.api.decide.mockRejectedValueOnce(new ApiError("network", null, "x"));
    await choose(container, "Approve");
    await click(button(container, "Record decision"));
    await settle(() =>
      expect(textOf(container)).toContain("could not reach the server"),
    );
    await click(button(container, "Dismiss and try again"));
    await typeInto(
      fieldByLabel(container, "Private notes"),
      "A different decision now.",
    );
    await click(button(container, "Record decision"));
    await settle(() => expect(textOf(container)).toContain("Status: Approved"));
    const keys = fake.api.decide.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("reports a submission that moved on, and reloads it", async () => {
    const { container, fake } = await open("under-review");
    // Another reviewer decided first.
    fake.state.detail = detailOf(
      reviewSubmission("approved", { id: fake.state.detail.submission.id }),
    );
    await choose(container, "Approve");
    await click(button(container, "Record decision"));
    await settle(() =>
      expect(textOf(container)).toContain(
        "This submission is approved and cannot take that action.",
      ),
    );
    await click(button(container, "Reload the submission"));
    await settle(() => expect(textOf(container)).toContain("Status: Approved"));
    expect(textOf(container)).not.toContain("cannot take that action");
  });

  it("says who may decide when a reviewer is refused, and offers to sign in again when the session ended", async () => {
    const { container, fake } = await open("under-review");
    fake.api.decide.mockRejectedValueOnce(new ApiError("forbidden", 403, "x"));
    await choose(container, "Approve");
    await click(button(container, "Record decision"));
    await settle(() =>
      expect(textOf(container)).toContain(
        "nobody can review their own collection",
      ),
    );
    await click(button(container, "Dismiss"));
    fake.api.decide.mockRejectedValueOnce(
      new ApiError("unauthorized", 401, "x"),
    );
    await click(button(container, "Record decision"));
    await settle(() =>
      expect(container.querySelector('a[href="/account"]')).not.toBeNull(),
    );
  });

  it("uses a fresh key for a decision that repeats an earlier one, because the earlier one is done", async () => {
    const { container, fake } = await open("approved");
    for (const [label, words] of [
      ["Suspend", "Under investigation."],
      ["Reinstate", ""],
      ["Suspend", "Under investigation."],
    ] as const) {
      await choose(container, label);
      if (words !== "")
        await typeInto(
          fieldByLabel(container, "Feedback for the creator"),
          words,
        );
      await click(button(container, "Record decision"));
      await settle(() => expect(fake.api.decide).toHaveBeenCalled());
    }
    await settle(() =>
      expect(textOf(container)).toContain("Status: Suspended"),
    );
    const keys = fake.api.decide.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
  });

  it("forgets the chosen move when the submission turns out to have moved on", async () => {
    const { container, fake } = await open("under-review");
    fake.state.detail = detailOf(
      reviewSubmission("approved", { id: fake.state.detail.submission.id }),
    );
    await choose(container, "Approve");
    await click(button(container, "Record decision"));
    await settle(() =>
      expect(textOf(container)).toContain("cannot take that action"),
    );
    await click(button(container, "Reload the submission"));
    await settle(() => expect(textOf(container)).toContain("Status: Approved"));
    // The old choice (approve) is no longer a legal move, so nothing is chosen any more.
    await click(button(container, "Record decision"));
    expect(textOf(container)).toContain("Choose what to do.");
    expect(fake.api.decide).toHaveBeenCalledTimes(1);
  });
});
