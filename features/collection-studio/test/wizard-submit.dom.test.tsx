import { ApiError } from "@ador/client-http";
import {
  button,
  buttonMatching,
  click,
  fieldByLabel,
  mount,
  settle,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { detail, imageAsset, itemRecord } from "./support/detail.ts";
import { fakeCollections } from "./support/fake-api.ts";
import { id } from "./support/stubs.ts";
import { heading, wizard } from "./support/wizard-view.tsx";

const complete = () => {
  const cover = imageAsset("collection-artwork");
  return detail(
    { coverAssetId: cover.id, description: "About", plannedSupply: 1 },
    [itemRecord(1)],
    [cover],
  );
};

async function openReview(fake: ReturnType<typeof fakeCollections>) {
  const container = await mount(wizard(fake));
  await settle(() => expect(heading(container)).not.toBeUndefined());
  await click(buttonMatching(container, /5\. Review/u));
  await settle(() =>
    expect(textOf(container)).not.toContain("Loading submissions"),
  );
  return container;
}

describe("collection wizard: review and submit", () => {
  it("shows what the draft needs and offers no submission while it is incomplete", async () => {
    const container = await openReview(
      fakeCollections(detail({ description: "About" })),
    );
    expect(heading(container)).toBe("Review");
    expect(textOf(container)).toContain("Still needed");
    expect(buttonMatching(container, /submit/iu)).toBeNull();
    expect(
      container.querySelector('a[href="/studio/collections"]'),
    ).not.toBeNull();
  });

  it("submits the saved version and then shows it as submitted with nothing more to do", async () => {
    const fake = fakeCollections(complete());
    const container = await openReview(fake);
    await click(button(container, "Submit for review"));
    await settle(() =>
      expect(textOf(container)).toContain("Submission 1: Submitted"),
    );
    expect(fake.api.submit).toHaveBeenCalledWith(
      {
        collectionId: fake.state.detail.collection.id,
        expectedRevision: fake.state.detail.collection.revision,
      },
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(buttonMatching(container, /submit/iu)).toBeNull();
  });

  it("retries a lost submission with the same key, so it can only be recorded once", async () => {
    const fake = fakeCollections(complete());
    fake.api.submit.mockRejectedValueOnce(new ApiError("network", null, "x"));
    const container = await openReview(fake);
    await click(button(container, "Submit for review"));
    await settle(() =>
      expect(textOf(container)).toContain("could not reach the server"),
    );
    await click(button(container, "Dismiss and try again"));
    await click(button(container, "Submit for review"));
    await settle(() =>
      expect(textOf(container)).toContain("Submission 1: Submitted"),
    );
    const keys = fake.api.submit.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(fake.state.submissions).toHaveLength(1);
  });

  it("reports a draft that changed elsewhere and offers to reload it, without submitting", async () => {
    const fake = fakeCollections(complete());
    const container = await openReview(fake);
    fake.state.detail = detail(
      { ...fake.state.detail.collection, revision: 9 },
      fake.state.detail.items,
      fake.state.detail.previews,
    );
    await click(button(container, "Submit for review"));
    await settle(() =>
      expect(textOf(container)).toContain(
        "The draft changed since it was loaded",
      ),
    );
    expect(fake.state.submissions).toEqual([]);
    await click(button(container, "Reload the draft"));
    await settle(() =>
      expect(textOf(container)).not.toContain("The draft changed since"),
    );
    await click(button(container, "Submit for review"));
    await settle(() =>
      expect(textOf(container)).toContain("Submission 1: Submitted"),
    );
    expect(fake.state.submissions[0]?.collectionRevision).toBe(9);
    // A different revision is a different request, so it gets its own key.
    const keys = fake.api.submit.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("will not submit while there are unsaved edits, and asks for them to be saved", async () => {
    const fake = fakeCollections(complete());
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Review"));
    await click(buttonMatching(container, /1\. Details/u));
    await typeInto(fieldByLabel(container, "Description"), "Edited, not saved");
    await click(buttonMatching(container, /5\. Review/u));
    await settle(() =>
      expect(textOf(container)).toContain(
        "Save your changes on the earlier steps",
      ),
    );
    expect(
      button(container, "Submit for review")?.hasAttribute("disabled"),
    ).toBe(true);
    expect(fake.api.submit).not.toHaveBeenCalled();
  });

  it("shows the reviewer's feedback after changes were requested, and lets the creator submit again", async () => {
    const fake = fakeCollections(complete());
    fake.state.submissions = [
      {
        collectionId: fake.state.detail.collection.id,
        collectionRevision: 1,
        createdAt: "2026-10-10T12:00:00.000Z",
        decisions: [
          {
            action: "request-changes",
            createdAt: "2026-10-10T13:00:00.000Z",
            creatorFeedback: "Add a banner.",
            nextState: "changes-requested",
          },
        ],
        id: id(),
        payloadHash: "a".repeat(64),
        sequence: 1,
        state: "changes-requested",
        updatedAt: "2026-10-10T13:00:00.000Z",
      },
    ];
    const container = await openReview(fake);
    expect(textOf(container)).toContain("Add a banner.");
    await click(button(container, "Submit again"));
    await settle(() =>
      expect(textOf(container)).toContain("Submission 2: Submitted"),
    );
  });
});
