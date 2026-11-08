import { button, click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it } from "vitest";

import { ProfileSetup } from "../src/ui/profile-setup.tsx";
import { fakeApi, policy, saved } from "./support/profile-api.ts";
import {
  nameField,
  open,
  radio,
  saveButton,
  share,
  type,
} from "./support/setup-page.tsx";

describe("the profile setup page for a player who has a profile", () => {
  const mine = { policy, profile: saved };

  it("loads their choices, shows them on the card, and has nothing to save until they change one", async () => {
    const { container } = await open(fakeApi({ mine }));
    expect((nameField(container) as HTMLInputElement).value).toBe("IceAda");
    expect(radio(container, "fox")?.checked).toBe(true);
    expect(textOf(container)).toContain("That's your name.");
    expect(textOf(container)).toContain("Joined Nov 2026");
    expect(textOf(container)).toContain("Nothing to save");
    expect(saveButton(container)?.disabled).toBe(true);
  });

  it("lets them change only the fighter, without asking about their own name", async () => {
    const { api, container } = await open(fakeApi({ mine }));
    await click(radio(container, "frog"));
    expect(saveButton(container)?.disabled).toBe(false);
    await click(saveButton(container));
    await settle(() =>
      expect(api.save).toHaveBeenCalledWith({
        avatar: "frog",
        name: "IceAda",
        visible: true,
      }),
    );
    expect(api.checkName).not.toHaveBeenCalled();
  });

  it("takes the profile down only after a second press, and says so", async () => {
    const { api, container } = await open(fakeApi({ mine }));
    await click(button(container, "Take my profile down"));
    expect(api.remove).not.toHaveBeenCalled();
    await click(button(container, "Keep it"));
    expect(button(container, "Take my profile down")).not.toBeNull();
    await click(button(container, "Take my profile down"));
    await click(button(container, "Yes, delete it"));
    await settle(() =>
      expect(textOf(container)).toContain("Your profile is gone."),
    );
    expect(api.remove).toHaveBeenCalledOnce();
    expect(button(container, "Take my profile down")).toBeNull();
  });
});

describe("the profile setup page when something goes wrong", () => {
  it("says the profile could not be loaded and tries again when asked", async () => {
    const api = fakeApi({ mine: new Error("offline") });
    const container = await mount(<ProfileSetup api={api} navigation={[]} />);
    await settle(() =>
      expect(textOf(container)).toContain("We couldn't load your profile."),
    );
    expect(saveButton(container)).toBeNull();
    await click(button(container, "Try again"));
    await settle(() => expect(api.getMine).toHaveBeenCalledTimes(2));
  });
});

describe("the profile setup page when a request fails", () => {
  it("says a name could not be checked, and still lets the player try to save it", async () => {
    const api = fakeApi();
    api.checkName.mockRejectedValue(new Error("offline"));
    const { container } = await open(api);
    await type(container, "IceAda");
    await settle(() =>
      expect(textOf(container)).toContain("Couldn't check that name."),
    );
    expect(saveButton(container)?.disabled).toBe(false);
  });

  it("says the profile could not be taken down, and keeps it", async () => {
    const api = fakeApi({ mine: { policy, profile: saved } });
    api.remove.mockRejectedValue(new Error("offline"));
    const { container } = await open(api);
    await click(button(container, "Take my profile down"));
    await click(button(container, "Yes, delete it"));
    await settle(() =>
      expect(textOf(container)).toContain("We couldn't take it down."),
    );
    expect(button(container, "Yes, delete it")).not.toBeNull();
  });

  it("gives the share sheet the page's own address on the origin the page is on", async () => {
    const { container } = await open(fakeApi(), share);
    await type(container, "IceAda");
    await settle(() => expect(saveButton(container)?.disabled).toBe(false));
    await click(saveButton(container));
    await settle(() => expect(button(container, "Share")).not.toBeNull());
    await click(button(container, "Share"));
    await settle(() => {
      const link = document.querySelector<HTMLInputElement>(
        "dialog input[readonly]",
      );
      expect(link?.value).toBe(`${window.location.origin}/p/IceAda`);
    });
  });
});
