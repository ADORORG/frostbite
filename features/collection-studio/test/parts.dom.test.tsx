import { ApiError } from "@frostbite/client-http";
import {
  button,
  buttonMatching,
  click,
  mount,
  textOf,
} from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { describeFailure } from "../src/client/error-copy.ts";
import { ItemList } from "../src/ui/components/item-list.tsx";
import { FailureNotice } from "../src/ui/components/notice.tsx";
import { StepNav } from "../src/ui/components/step-nav.tsx";
import { detail, imageAsset, itemRecord } from "./support/detail.ts";

describe("item list", () => {
  const items = [
    itemRecord(1, undefined, "First"),
    itemRecord(2, undefined, "Second"),
  ];

  it("says when there are no items", async () => {
    const container = await mount(
      <ItemList
        busy={false}
        items={[]}
        onEdit={() => undefined}
        onRemove={() => undefined}
        previews={[]}
      />,
    );
    expect(textOf(container)).toContain("No items yet.");
  });

  it("shows each item in order with its image and trait count, and reports an edit", async () => {
    const preview = imageAsset(
      "collection-item-artwork",
      items[0]?.imageAssetId,
    );
    const onEdit = vi.fn();
    const container = await mount(
      <ItemList
        busy={false}
        items={items}
        onEdit={onEdit}
        onRemove={() => undefined}
        previews={[preview]}
      />,
    );
    expect(textOf(container)).toContain("1. First");
    expect(textOf(container)).toContain("2. Second");
    expect(textOf(container)).toContain("1 trait");
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(textOf(container)).toContain("Preview unavailable");
    await click(button(container, "Edit First"));
    expect(onEdit).toHaveBeenCalledWith(items[0]);
  });

  it("pluralises traits, and asks twice before removing, and lets the removal be cancelled", async () => {
    const many = [
      {
        ...itemRecord(1, undefined, "First"),
        attributes: [
          { trait: "a", value: "1" },
          { trait: "b", value: "2" },
        ],
      },
    ];
    const onRemove = vi.fn();
    const container = await mount(
      <ItemList
        busy={false}
        items={many}
        onEdit={() => undefined}
        onRemove={onRemove}
        previews={[]}
      />,
    );
    expect(textOf(container)).toContain("2 traits");
    await click(button(container, "Remove First"));
    expect(onRemove).not.toHaveBeenCalled();
    await click(button(container, "Keep it"));
    expect(button(container, "Remove First")).not.toBeNull();
    await click(button(container, "Remove First"));
    await click(button(container, "Confirm removing First"));
    expect(onRemove).toHaveBeenCalledWith(many[0]);
    expect(button(container, "Confirm removing First")).toBeNull();
  });

  it("disables every action while busy", async () => {
    const container = await mount(
      <ItemList
        busy
        items={items}
        onEdit={() => undefined}
        onRemove={() => undefined}
        previews={[]}
      />,
    );
    expect(buttonMatching(container, /^Edit /u)?.disabled).toBe(true);
    expect(buttonMatching(container, /^Remove /u)?.disabled).toBe(true);
  });
});

describe("step navigation", () => {
  it("announces the current step, lets any step be chosen, and marks the steps that are done", async () => {
    const onSelect = vi.fn();
    const filled = detail({ description: "About" }, [itemRecord(1)]);
    const container = await mount(
      <StepNav current="images" detail={filled} onSelect={onSelect} />,
    );
    expect(container.querySelector('[aria-current="step"]')?.textContent).toBe(
      "3. Images",
    );
    expect(container.querySelectorAll("li")).toHaveLength(5);
    expect(textOf(container).match(/Done/gu)).toHaveLength(2);
    // The state drives the stepper's look: done steps, the current one, and what is still to do.
    expect(
      [...container.querySelectorAll("button")].map(
        (step) => step.dataset.state,
      ),
    ).toEqual(["done", "todo", "current", "done", "todo"]);
    await click(buttonMatching(container, /4\. Items/u));
    expect(onSelect).toHaveBeenCalledWith("items");
  });
});

describe("failure notice", () => {
  const props = { applyHref: "/apply", onDismiss: vi.fn(), onReload: vi.fn() };

  it("offers a reload for a conflict, an application link when not approved, and retry for a temporary fault", async () => {
    const conflict = await mount(
      <FailureNotice
        {...props}
        failure={describeFailure(new ApiError("conflict", 409, "Changed."))}
      />,
    );
    expect(button(conflict, "Reload the draft")).not.toBeNull();
    expect(button(conflict, "Dismiss")).not.toBeNull();
    const refused = await mount(
      <FailureNotice
        {...props}
        failure={describeFailure(new ApiError("forbidden", 403, "x"))}
      />,
    );
    expect(refused.querySelector('a[href="/apply"]')).not.toBeNull();
    const temporary = await mount(
      <FailureNotice
        {...props}
        failure={describeFailure(new ApiError("network", null, "x"))}
      />,
    );
    expect(button(temporary, "Dismiss and try again")).not.toBeNull();
    expect(button(temporary, "Reload the draft")).toBeNull();
  });

  it("reports a reload and a dismissal", async () => {
    const onDismiss = vi.fn();
    const onReload = vi.fn();
    const container = await mount(
      <FailureNotice
        applyHref="/apply"
        failure={describeFailure(new ApiError("conflict", 409, "Changed."))}
        onDismiss={onDismiss}
        onReload={onReload}
      />,
    );
    await click(button(container, "Reload the draft"));
    await click(button(container, "Dismiss"));
    expect([onReload.mock.calls.length, onDismiss.mock.calls.length]).toEqual([
      1, 1,
    ]);
  });
});
