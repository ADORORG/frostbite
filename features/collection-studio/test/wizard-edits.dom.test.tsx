import { ApiError } from "@frostbite/client-http";
import {
  button,
  buttonMatching,
  click,
  fieldByLabel,
  mount,
  settle,
  textOf,
  typeInto,
} from "@frostbite/test-kit/dom";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { detail } from "./support/detail.ts";
import { fakeCollections } from "./support/fake-api.ts";
import { heading, wizard } from "./support/wizard-view.tsx";

describe("collection wizard: unsaved edits", () => {
  const leaveAttempt = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it("is not unsaved once a typed change is typed back to what is saved", async () => {
    const fake = fakeCollections(detail({ description: "About" }));
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Images"));
    await click(buttonMatching(container, /1\. Details/u));
    const field = fieldByLabel(container, "Description");
    await typeInto(field, "About, and more");
    expect(leaveAttempt()).toBe(true);
    await typeInto(field, "About");
    expect(leaveAttempt()).toBe(false);
  });

  it("does not move on when the save fails, and stays on the step with the notice", async () => {
    const fake = fakeCollections();
    fake.api.save.mockRejectedValue(new ApiError("conflict", 409, "Stale."));
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Details"));
    await typeInto(fieldByLabel(container, "Description"), "About");
    await click(button(container, "Save and continue"));
    await settle(() => expect(textOf(container)).toContain("Stale."));
    expect(heading(container)).toBe("Details");
    expect(window.location.hash).toBe("");
  });

  it("clears the last failure when the next action starts", async () => {
    const fake = fakeCollections();
    fake.api.save.mockRejectedValueOnce(new ApiError("network", null, "x"));
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Details"));
    await typeInto(fieldByLabel(container, "Description"), "About");
    await click(button(container, "Save"));
    await settle(() =>
      expect(textOf(container)).toContain("could not reach the server"),
    );
    await click(button(container, "Save"));
    await settle(() => expect(textOf(container)).toContain("Saved."));
    expect(textOf(container)).not.toContain("could not reach the server");
  });

  it("follows the server again after a save, rather than holding the saved text", async () => {
    const fake = fakeCollections();
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Details"));
    await typeInto(fieldByLabel(container, "Description"), "Mine");
    await click(button(container, "Save"));
    await settle(() => expect(textOf(container)).toContain("Saved."));
    // Changed elsewhere, then seen here after an item change reloads the draft.
    fake.state.detail = detail({
      ...fake.state.detail.collection,
      description: "Theirs",
      revision: fake.state.detail.collection.revision + 1,
    });
    await click(buttonMatching(container, /4\. Items/u));
    await typeInto(fieldByLabel(container, "Item name"), "First item");
    await act(() =>
      container
        .querySelector<HTMLInputElement>('fieldset input[type="radio"]')
        ?.click(),
    );
    await click(button(container, "Add item"));
    await settle(() => expect(textOf(container)).toContain("1. First item"));
    await click(buttonMatching(container, /1\. Details/u));
    await settle(() =>
      expect(fieldByLabel(container, "Description").value).toBe("Theirs"),
    );
  });
});
