import { chainOptionSchema } from "@frostbite/shared/chain";
import type {
  CollectionSubmission,
  SubmissionState,
} from "@frostbite/shared/collections";
import { button, click, mount, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { ReviewStep } from "../src/ui/components/review-step.tsx";
import type { Resource } from "../src/ui/hooks/use-resource.ts";
import { detail, imageAsset, itemRecord } from "./support/detail.ts";
import { id, signet } from "./support/stubs.ts";

const chain = chainOptionSchema.parse({
  chainId: signet,
  displayName: "Bitcoin signet",
  enabled: true,
  family: "bitcoin-alkanes",
  role: "public-beta",
});
const stamp = "2026-10-10T12:00:00.000Z";
const submission = (
  state: SubmissionState,
  overrides: Partial<CollectionSubmission> = {},
): CollectionSubmission => ({
  collectionId: id(),
  collectionRevision: 1,
  createdAt: stamp,
  decisions: [],
  id: id(),
  payloadHash: "a".repeat(64),
  sequence: 1,
  state,
  updatedAt: stamp,
  ...overrides,
});
const loaded = (
  ...submissions: CollectionSubmission[]
): Resource<{ submissions: CollectionSubmission[] }> => ({
  data: { submissions },
  status: "ready",
});

const cover = imageAsset("collection-artwork");
const complete = () =>
  detail(
    { coverAssetId: cover.id, description: "About", plannedSupply: 1 },
    [itemRecord(1)],
    [cover],
  );

function view(overrides: Partial<Parameters<typeof ReviewStep>[0]> = {}) {
  const onSubmit = vi.fn();
  const onRefresh = vi.fn();
  const element = (
    <ReviewStep
      busy={false}
      chains={[chain]}
      detail={complete()}
      listHref="/studio/collections"
      onRefresh={onRefresh}
      onSubmit={onSubmit}
      submissions={loaded()}
      unsaved={false}
      {...overrides}
    />
  );
  return { element, onRefresh, onSubmit };
}

describe("review step summary", () => {
  it("names the chain and shows the cover when there is one, and the raw chain id and a placeholder when not", async () => {
    expect(textOf(await mount(view().element))).toContain("Bitcoin signet");
    const withCover = await mount(view().element);
    expect(withCover.querySelectorAll("img")).toHaveLength(1);
    const bare = await mount(view({ chains: [], detail: detail() }).element);
    expect(textOf(bare)).toContain(signet);
    expect(textOf(bare)).toContain("No cover image yet");
  });
});

describe("review step before submitting", () => {
  it("lists what is missing, offers no submit button, and says what is needed", async () => {
    const container = await mount(view({ detail: detail() }).element);
    expect(textOf(container)).toContain("Still needed");
    expect(textOf(container)).toContain(
      "It needs a description, a cover image, every planned item",
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("offers to submit a complete collection, and reports the click", async () => {
    const { element, onSubmit } = view();
    const container = await mount(element);
    expect(textOf(container)).not.toContain("Still needed");
    expect(textOf(container)).toContain("Submitting freezes this version");
    await click(button(container, "Submit for review"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("disables the button while a submission is under way", async () => {
    const container = await mount(view({ busy: true }).element);
    expect(
      button(container, "Submit for review")?.hasAttribute("disabled"),
    ).toBe(true);
  });

  it("asks for unsaved edits to be saved first and will not submit them", async () => {
    const { element, onSubmit } = view({ unsaved: true });
    const container = await mount(element);
    expect(textOf(container)).toContain(
      "Save your changes on the earlier steps before submitting.",
    );
    const submit = button(container, "Submit for review");
    expect(submit?.hasAttribute("disabled")).toBe(true);
    await click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("review step after submitting", () => {
  it.each([
    ["submitted", "Submission 1: Submitted"],
    ["under-review", "Submission 1: In review"],
    ["approved", "Submission 1: Approved"],
    ["suspended", "Submission 1: Suspended"],
  ] as const)(
    "shows a %s submission and offers no second one",
    async (state, label) => {
      const container = await mount(
        view({ submissions: loaded(submission(state)) }).element,
      );
      expect(textOf(container)).toContain(label);
      expect(button(container, "Submit for review")).toBeNull();
      expect(button(container, "Submit again")).toBeNull();
    },
  );

  it("says approval does not publish anything", async () => {
    const container = await mount(
      view({ submissions: loaded(submission("approved")) }).element,
    );
    expect(textOf(container)).toContain("does not publish or launch it");
  });

  it("shows the reviewer's feedback and offers to submit again after changes were requested", async () => {
    const asked = submission("changes-requested", {
      decisions: [
        {
          action: "start-review",
          createdAt: stamp,
          creatorFeedback: "",
          nextState: "under-review",
        },
        {
          action: "request-changes",
          createdAt: "2026-10-10T13:00:00.000Z",
          creatorFeedback: "Please add a banner.",
          nextState: "changes-requested",
        },
      ],
    });
    const { element, onSubmit } = view({ submissions: loaded(asked) });
    const container = await mount(element);
    // Every step is in the history with its date; only a step with words has feedback under it.
    const steps = [
      ...container.querySelectorAll(
        'ol[aria-label="History of this submission"] > li',
      ),
    ].map((item) => item.textContent ?? "");
    expect(steps).toEqual([
      "Submitted 2026-10-10",
      "In review 2026-10-10",
      "Changes requested 2026-10-10Please add a banner.",
    ]);
    expect(
      container.querySelectorAll('p[aria-label="Feedback from a reviewer"]'),
    ).toHaveLength(1);
    await click(button(container, "Submit again"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it.each(["rejected", "revoked"] as const)(
    "is final after %s: feedback shown, nothing to submit",
    async (state) => {
      const container = await mount(
        view({
          submissions: loaded(
            submission(state, {
              decisions: [
                {
                  action: "reject",
                  createdAt: stamp,
                  creatorFeedback: "Not suitable.",
                  nextState: state,
                },
              ],
            }),
          ),
        }).element,
      );
      expect(textOf(container)).toContain("cannot be submitted again");
      expect(textOf(container)).toContain("Not suitable.");
      expect(container.querySelector("button")).toBeNull();
    },
  );

  it("warns when the draft has changed since the version that was submitted, and only then", async () => {
    const frozen = submission("submitted", { collectionRevision: 1 });
    const same = await mount(view({ submissions: loaded(frozen) }).element);
    expect(textOf(same)).not.toContain(
      "You have changed this collection since it was submitted",
    );
    const moved = await mount(
      view({
        detail: detail(
          { ...complete().collection, revision: 4 },
          complete().items,
          [cover],
        ),
        submissions: loaded(frozen),
      }).element,
    );
    expect(textOf(moved)).toContain(
      "You have changed this collection since it was submitted",
    );
  });
});

describe("review step history", () => {
  it("shows when the collection was submitted even before any reviewer has acted", async () => {
    const container = await mount(
      view({ submissions: loaded(submission("submitted")) }).element,
    );
    expect(
      container.querySelector('ol[aria-label="History of this submission"]')
        ?.textContent,
    ).toBe("Submitted 2026-10-10");
  });

  it("never shows who decided, or anything but the date and the words written for the creator", async () => {
    const container = await mount(
      view({
        submissions: loaded(
          submission("approved", {
            decisions: [
              {
                action: "approve",
                createdAt: "2026-10-11T09:30:00.000Z",
                creatorFeedback: "",
                nextState: "approved",
              },
            ],
          }),
        ),
      }).element,
    );
    const history = container.querySelector(
      'ol[aria-label="History of this submission"]',
    )?.textContent;
    expect(history).toBe("Submitted 2026-10-10Approved 2026-10-11");
  });
});

describe("review step while submissions load", () => {
  it("says it is loading and offers nothing to click", async () => {
    const container = await mount(
      view({ submissions: { status: "loading" } }).element,
    );
    expect(textOf(container)).toContain("Loading submissions…");
    expect(button(container, "Submit for review")).toBeNull();
  });

  it("reports a failure with a retry, and does not offer to submit blind", async () => {
    const failed: Resource<{ submissions: CollectionSubmission[] }> = {
      data: null,
      failure: { kind: "temporary", message: "x", retryable: true },
      status: "error",
    };
    const { element, onRefresh } = view({ submissions: failed });
    const container = await mount(element);
    expect(textOf(container)).toContain(
      "Your submissions could not be loaded.",
    );
    expect(button(container, "Submit for review")).toBeNull();
    await click(button(container, "Retry"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
