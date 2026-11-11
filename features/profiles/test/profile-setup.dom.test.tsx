import { button, click, settle, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it } from "vitest";

import { fakeApi } from "./support/profile-api.ts";
import {
  nameField,
  open,
  radio,
  saveButton,
  share,
  type,
} from "./support/setup-page.tsx";

describe("the profile setup page for a player with no profile", () => {
  it("shows the three stages and a card waiting for a name, and cannot save yet", async () => {
    const { container } = await open();
    const text = textOf(container);
    expect(text).toContain("Make your player card");
    expect(text).toContain("Choose your fighter");
    expect(text).toContain("Name your player");
    expect(text).toContain("Show your page");
    expect(text).toContain("Your name");
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(12);
    expect(saveButton(container)?.disabled).toBe(true);
  });

  it("says at once what is wrong with the shape of a name, asking the server nothing", async () => {
    const { api, container } = await open();
    await type(container, "a b");
    expect(textOf(container)).toContain("Letters, numbers, _ and - only");
    await type(container, "ab");
    expect(textOf(container)).toContain("Use at least 3 characters.");
    expect(saveButton(container)?.disabled).toBe(true);
    expect(api.checkName).not.toHaveBeenCalled();
  });

  it("asks whether a name is free once the player pauses, then lets them save it", async () => {
    const { api, container } = await open();
    await type(container, "IceAda");
    expect(textOf(container)).toContain("Checking…");
    await settle(() =>
      expect(textOf(container)).toContain("Free: it's yours if you save."),
    );
    expect(api.checkName).toHaveBeenCalledWith(
      "IceAda",
      expect.any(AbortSignal),
    );
    expect(saveButton(container)?.disabled).toBe(false);
  });

  it("holds Save back for a name that is taken, and says so", async () => {
    const { container } = await open(
      fakeApi({ check: () => ({ status: "taken" }) }),
    );
    await type(container, "Grace");
    await settle(() =>
      expect(textOf(container)).toContain("Someone already has that name."),
    );
    expect(saveButton(container)?.disabled).toBe(true);
  });

  it("holds Save back for a name the server blocks", async () => {
    const { container } = await open(
      fakeApi({ check: () => ({ reason: "blocked", status: "invalid" }) }),
    );
    await type(container, "Adm1n");
    await settle(() =>
      expect(textOf(container)).toContain("That name isn't available."),
    );
    expect(saveButton(container)?.disabled).toBe(true);
  });

  it("saves the fighter, name and visibility the player chose, and says the page is live with its link", async () => {
    const { api, container } = await open();
    await click(radio(container, "owl"));
    await type(container, "IceAda");
    await settle(() => expect(saveButton(container)?.disabled).toBe(false));
    await click(saveButton(container));
    await settle(() =>
      expect(textOf(container)).toContain("You're on the map!"),
    );
    expect(api.save).toHaveBeenCalledExactlyOnceWith({
      avatar: "owl",
      name: "IceAda",
      visible: true,
    });
    expect(textOf(container)).toContain("/p/IceAda");
    expect(container.querySelector('a[href="/p/IceAda"]')).not.toBeNull();
  });

  it("offers to share the new page when sharing is configured, and not otherwise", async () => {
    const withShare = await open(fakeApi(), share);
    await type(withShare.container, "IceAda");
    await settle(() =>
      expect(saveButton(withShare.container)?.disabled).toBe(false),
    );
    await click(saveButton(withShare.container));
    await settle(() => expect(textOf(withShare.container)).toContain("Share"));
    const without = await open();
    await type(without.container, "IceAda");
    await settle(() =>
      expect(saveButton(without.container)?.disabled).toBe(false),
    );
    await click(saveButton(without.container));
    await settle(() =>
      expect(textOf(without.container)).toContain("You're on the map!"),
    );
    expect(button(without.container, "Share")).toBeNull();
  });

  it("says a profile that is switched off is saved and hidden, with no link", async () => {
    const { container } = await open();
    await type(container, "IceAda");
    await settle(() => expect(saveButton(container)?.disabled).toBe(false));
    await click(container.querySelector('button[role="switch"]'));
    expect(textOf(container)).toContain("Hidden.");
    await click(saveButton(container));
    await settle(() =>
      expect(textOf(container)).toContain(
        "Your page stays hidden until you switch it on.",
      ),
    );
    expect(container.querySelector('a[href="/p/IceAda"]')).toBeNull();
  });

  it("says why the server turned a save down, in words", async () => {
    const { container } = await open(
      fakeApi({
        save: () => ({
          reason: null,
          refusal: "name-locked",
          status: "refused",
          until: "2026-12-08T00:00:00.000Z",
        }),
      }),
    );
    await type(container, "IceAda");
    await settle(() => expect(saveButton(container)?.disabled).toBe(false));
    await click(saveButton(container));
    await settle(() =>
      expect(textOf(container)).toContain(
        "You can change your name again on Dec 8, 2026.",
      ),
    );
  });

  it("says a name was taken between the check and the save", async () => {
    const { container } = await open(
      fakeApi({
        save: () => ({
          reason: null,
          refusal: "name-taken",
          status: "refused",
          until: null,
        }),
      }),
    );
    await type(container, "IceAda");
    await settle(() => expect(saveButton(container)?.disabled).toBe(false));
    await click(saveButton(container));
    await settle(() =>
      expect(textOf(container)).toContain("Someone already has that name."),
    );
  });

  it("says a rule the form could not know (a blocked word found on save)", async () => {
    const { container } = await open(
      fakeApi({
        save: () => ({
          reason: "blocked",
          refusal: "name-invalid",
          status: "refused",
          until: null,
        }),
      }),
    );
    await type(container, "IceAda");
    await settle(() => expect(saveButton(container)?.disabled).toBe(false));
    await click(saveButton(container));
    await settle(() =>
      expect(textOf(container)).toContain(
        "That name isn't available. Try another.",
      ),
    );
  });

  it("says a save that could not be sent failed, and keeps what was typed", async () => {
    const { container } = await open(
      fakeApi({ save: () => new Error("offline") }),
    );
    await type(container, "IceAda");
    await settle(() => expect(saveButton(container)?.disabled).toBe(false));
    await click(saveButton(container));
    await settle(() =>
      expect(textOf(container)).toContain("We couldn't save that."),
    );
    expect((nameField(container) as HTMLInputElement).value).toBe("IceAda");
  });
});
