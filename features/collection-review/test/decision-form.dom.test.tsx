import {
  button,
  click,
  fieldByLabel,
  mount,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { emptyDecisionForm } from "../src/client/decisions.ts";
import { DecisionForm } from "../src/ui/components/decision-form.tsx";

const noErrors = {};

function form(overrides: Partial<Parameters<typeof DecisionForm>[0]> = {}) {
  const onSubmit = vi.fn(async () => true);
  return {
    element: (
      <DecisionForm
        busy={false}
        errors={noErrors}
        onSubmit={onSubmit}
        state="under-review"
        {...overrides}
      />
    ),
    onSubmit,
  };
}

const choose = (container: HTMLElement, label: string) =>
  click(
    [...container.querySelectorAll("label")]
      .find((candidate) => candidate.textContent?.startsWith(label))
      ?.querySelector("input") ?? null,
  );

describe("decision form", () => {
  it("offers only the moves the state allows, as a radio group", async () => {
    const container = await mount(form().element);
    const options = [...container.querySelectorAll('input[type="radio"]')].map(
      (input) => input.closest("label")?.textContent,
    );
    expect(options).toEqual(["Approve", "Request changes", "Reject"]);
  });

  it("offers a first step for a new submission, and says nothing more is possible for a finished one", async () => {
    const fresh = await mount(form({ state: "submitted" }).element);
    expect(textOf(fresh)).toContain("Start review");
    const done = await mount(form({ state: "rejected" }).element);
    expect(textOf(done)).toContain("No further decisions are possible");
    expect(done.querySelector("button")).toBeNull();
  });

  it("records an approval without feedback, with what was chosen and typed, and then clears itself", async () => {
    const { element, onSubmit } = form();
    const container = await mount(element);
    await choose(container, "Approve");
    await typeInto(fieldByLabel(container, "Private notes"), "Looks good.");
    await click(button(container, "Record decision"));
    expect(onSubmit).toHaveBeenCalledWith({
      action: "approve",
      creatorFeedback: "",
      privateNotes: "Looks good.",
    });
    expect(fieldByLabel(container, "Private notes").value).toBe("");
  });

  it("keeps what was typed when the decision could not be recorded", async () => {
    const onSubmit = vi.fn(async () => false);
    const container = await mount(form({ onSubmit }).element);
    await choose(container, "Request changes");
    await typeInto(
      fieldByLabel(container, "Feedback for the creator"),
      "Add a banner.",
    );
    await click(button(container, "Record decision"));
    expect(fieldByLabel(container, "Feedback for the creator").value).toBe(
      "Add a banner.",
    );
  });

  it("says when feedback is required and when it is optional", async () => {
    const container = await mount(form().element);
    expect(textOf(container)).toContain(
      "Optional. The creator will read this.",
    );
    await choose(container, "Reject");
    expect(textOf(container)).toContain(
      "Required. The creator will read this.",
    );
  });

  it("asks for a second click before rejecting, and cancelling or changing the choice withdraws it", async () => {
    const { element, onSubmit } = form();
    const container = await mount(element);
    await choose(container, "Reject");
    await typeInto(
      fieldByLabel(container, "Feedback for the creator"),
      "Not suitable.",
    );
    await click(button(container, "Record decision"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(button(container, "Confirm: reject")).not.toBeNull();
    await click(button(container, "Cancel"));
    expect(button(container, "Record decision")).not.toBeNull();
    await click(button(container, "Record decision"));
    await choose(container, "Approve");
    expect(button(container, "Record decision")).not.toBeNull();
    await choose(container, "Reject");
    await click(button(container, "Record decision"));
    await click(button(container, "Confirm: reject"));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({
      action: "reject",
      creatorFeedback: "Not suitable.",
      privateNotes: "",
    });
  });

  it("does not ask twice for an approval, which can be undone by a later decision", async () => {
    const { element, onSubmit } = form();
    const container = await mount(element);
    await choose(container, "Approve");
    await click(button(container, "Record decision"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("shows the field errors it is given and disables everything while busy", async () => {
    const errors = {
      action: "Choose what to do.",
      creatorFeedback: "Write what the creator should know.",
      privateNotes: "Keep notes short.",
    };
    const container = await mount(form({ busy: true, errors }).element);
    for (const message of Object.values(errors))
      expect(textOf(container)).toContain(message);
    expect(button(container, "Record decision")?.hasAttribute("disabled")).toBe(
      true,
    );
    for (const input of container.querySelectorAll("input, textarea"))
      expect(input.hasAttribute("disabled")).toBe(true);
  });

  it("starts empty", () => {
    expect(emptyDecisionForm).toEqual({
      action: null,
      creatorFeedback: "",
      privateNotes: "",
    });
  });
});
