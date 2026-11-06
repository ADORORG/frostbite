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

import { detail, imageAsset, itemRecord } from "./support/detail.ts";
import { fakeCollections } from "./support/fake-api.ts";
import { heading, wizard } from "./support/wizard-view.tsx";

describe("collection wizard: opening a draft", () => {
  it("shows loading, then lands on the first step that still asks for something", async () => {
    const fake = fakeCollections();
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Details"));
    expect(textOf(container)).toContain("First light");
    expect(container.querySelector('[aria-current="step"]')?.textContent).toBe(
      "1. Details",
    );
  });

  it("resumes at the images step when the details are done, and at review when everything is", async () => {
    const withDetails = fakeCollections(detail({ description: "About" }));
    const first = await mount(wizard(withDetails));
    await settle(() => expect(heading(first)).toBe("Images"));
    const cover = imageAsset("collection-artwork");
    const complete = fakeCollections(
      detail({ coverAssetId: cover.id, description: "About" }, [itemRecord(1)]),
    );
    const second = await mount(wizard(complete));
    await settle(() => expect(heading(second)).toBe("Review"));
  });

  it("opens the step named in the URL hash", async () => {
    window.history.replaceState(null, "", "#supply");
    const container = await mount(wizard(fakeCollections()));
    await settle(() => expect(heading(container)).toBe("Supply and chain"));
  });

  it("says a draft cannot be found, with no retry, and offers a retry for a temporary fault", async () => {
    const missing = fakeCollections();
    missing.api.read.mockRejectedValue(new ApiError("not_found", 404, "x"));
    const first = await mount(wizard(missing));
    await settle(() =>
      expect(textOf(first)).toContain("This collection could not be found."),
    );
    expect(button(first, "Retry")).toBeNull();

    const flaky = fakeCollections();
    flaky.api.read.mockRejectedValueOnce(new ApiError("network", null, "x"));
    const second = await mount(wizard(flaky));
    await settle(() => expect(button(second, "Retry")).not.toBeNull());
    await click(button(second, "Retry"));
    await settle(() => expect(heading(second)).toBe("Details"));
  });

  it("shows a loading state while the draft loads", async () => {
    const fake = fakeCollections();
    fake.api.read.mockReturnValue(new Promise(() => undefined));
    const container = await mount(wizard(fake));
    expect(textOf(container)).toContain("Loading your collection…");
  });
});

describe("collection wizard: saving", () => {
  it("validates before saving, saves the whole draft against the current revision, and says so", async () => {
    const fake = fakeCollections();
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Details"));
    await typeInto(fieldByLabel(container, "Collection name"), "   ");
    await click(button(container, "Save"));
    expect(fake.api.save).not.toHaveBeenCalled();
    expect(textOf(container)).toContain(
      "Problem: Enter a name of up to 120 characters.",
    );

    await typeInto(fieldByLabel(container, "Collection name"), "Renamed");
    await typeInto(fieldByLabel(container, "Description"), "About it");
    expect(textOf(container)).toContain(
      "You have changes that are not saved yet.",
    );
    await click(button(container, "Save"));
    expect(fake.api.save).toHaveBeenCalledWith({
      collectionId: fake.state.detail.collection.id,
      draft: expect.objectContaining({
        description: "About it",
        name: "Renamed",
      }),
      expectedRevision: 1,
    });
    await settle(() => expect(textOf(container)).toContain("Saved."));
    expect(textOf(container)).not.toContain("not saved yet");
    expect(container.querySelector("h2")?.textContent).toBe("Renamed");
  });

  it("saves and moves on, putting focus on the new step's heading and recording it in the URL", async () => {
    const fake = fakeCollections();
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Details"));
    await typeInto(fieldByLabel(container, "Description"), "About");
    document.body.append(container);
    await click(button(container, "Save and continue"));
    await settle(() => expect(heading(container)).toBe("Supply and chain"));
    expect(document.activeElement?.tagName).toBe("H3");
    expect(window.location.hash).toBe("#supply");
  });

  it("tells the creator a draft that changed elsewhere must be reloaded, and reloads it", async () => {
    const fake = fakeCollections();
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Details"));
    // Someone else saved: the server is now ahead of the page.
    fake.state.detail = detail({
      ...fake.state.detail.collection,
      name: "Changed elsewhere",
      revision: 4,
    });
    await typeInto(fieldByLabel(container, "Description"), "Mine");
    await click(button(container, "Save"));
    await settle(() =>
      expect(textOf(container)).toContain(
        "The draft changed since it was loaded",
      ),
    );
    await click(button(container, "Reload the draft"));
    await settle(() =>
      expect(container.querySelector("h2")?.textContent).toBe(
        "Changed elsewhere",
      ),
    );
    expect(textOf(container)).not.toContain("The draft changed since");
  });

  it("after a reload, saves only what the creator changed and keeps what the other device saved", async () => {
    const fake = fakeCollections();
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Details"));
    fake.state.detail = detail({
      ...fake.state.detail.collection,
      provenance: "Theirs",
      revision: 4,
    });
    await typeInto(fieldByLabel(container, "Description"), "Mine");
    await click(button(container, "Save"));
    await settle(() =>
      expect(textOf(container)).toContain("The draft changed since"),
    );
    await click(button(container, "Reload the draft"));
    await settle(() =>
      expect(fieldByLabel(container, "Provenance").value).toBe("Theirs"),
    );
    await click(button(container, "Save"));
    await settle(() => expect(fake.api.save).toHaveBeenCalledTimes(2));
    expect(fake.state.detail.collection).toMatchObject({
      description: "Mine",
      provenance: "Theirs",
    });
  });

  it("points a creator who is not approved to the application, and lets the notice be dismissed", async () => {
    const fake = fakeCollections();
    fake.api.save.mockRejectedValue(new ApiError("forbidden", 403, "x"));
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Details"));
    await typeInto(fieldByLabel(container, "Description"), "x");
    await click(button(container, "Save"));
    await settle(() =>
      expect(textOf(container)).toContain("Only approved creators"),
    );
    expect(
      container.querySelector('a[href="/studio/creator-application"]'),
    ).not.toBeNull();
    await click(button(container, "Dismiss"));
    expect(textOf(container)).not.toContain("Only approved creators");
  });

  it("warns before leaving the page with unsaved changes, and not otherwise", async () => {
    const container = await mount(wizard(fakeCollections()));
    await settle(() => expect(heading(container)).toBe("Details"));
    const attempt = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(attempt()).toBe(false);
    await typeInto(fieldByLabel(container, "Description"), "typed");
    expect(attempt()).toBe(true);
  });

  it("keeps unsaved edits when the draft reloads after an item change", async () => {
    const fake = fakeCollections(detail({ description: "About" }));
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Images"));
    await click(buttonMatching(container, /4\. Items/u));
    await click(buttonMatching(container, /1\. Details/u));
    await typeInto(fieldByLabel(container, "Collection name"), "Unsaved name");
    await click(buttonMatching(container, /4\. Items/u));
    await act(() => undefined);
    await click(buttonMatching(container, /1\. Details/u));
    expect(fieldByLabel(container, "Collection name")).toHaveProperty(
      "value",
      "Unsaved name",
    );
  });
});
