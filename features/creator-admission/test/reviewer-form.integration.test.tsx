import { creatorReviewReasonCodes } from "@frostbite/shared/creator-admission";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewerForm } from "../src/ui/reviewer-form.tsx";
import { choose, mount } from "./support/mount.ts";

let unmount: (() => Promise<void>) | null = null;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
  await unmount?.();
  unmount = null;
  vi.unstubAllGlobals();
});

describe("reviewer decision form", () => {
  it("offers exactly the legal moves and prefills the usual reason for the chosen one", async () => {
    const view = await mount(
      <ReviewerForm
        applicationId={createUuidV7()}
        onDecided={vi.fn()}
        state="under-review"
      />,
    );
    unmount = view.unmount;
    const select = view.container.querySelector<HTMLSelectElement>(
      "select[name=action]",
    );
    const reason = () =>
      view.container.querySelector<HTMLInputElement>("input[name=reasonCode]");
    if (select === null) throw new Error("Expected the decision control");
    expect([...select.options].map((option) => option.value)).toEqual([
      "approve",
      "request-changes",
      "reject",
    ]);
    expect(reason()?.value).toBe(creatorReviewReasonCodes.approve);
    await choose(select, "reject");
    expect(reason()?.value).toBe(creatorReviewReasonCodes.reject);
  });
});
