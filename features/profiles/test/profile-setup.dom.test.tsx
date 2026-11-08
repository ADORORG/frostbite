import {
  button,
  click,
  fieldByLabel,
  mount,
  settle,
  textOf,
  typeInto,
} from "@frostbite/test-kit/dom";
import type { ShareConfig } from "@frostbite/share";
import { describe, expect, it } from "vitest";

import { ProfileSetup } from "../src/ui/profile-setup.tsx";
import { fakeApi, policy, saved } from "./support/profile-api.ts";

const share: ShareConfig = {
  hashtags: [],
  platforms: [
    {
      accent: "#000000",
      id: "x",
      label: "X",
      mark: "X",
      template: "https://x.example/?t={text}&u={url}",
    },
  ],
};

async function open(api = fakeApi(), shared?: ShareConfig) {
  const container = await mount(
    <ProfileSetup
      api={api}
      navigation={[]}
      {...(shared === undefined ? {} : { share: shared })}
    />,
  );
  await settle(() =>
    expect(textOf(container)).toContain("Choose your fighter"),
  );
  return { api, container };
}
const nameField = (container: HTMLElement) =>
  fieldByLabel(container, "Player name");
const saveButton = (container: HTMLElement) =>
  button(container, "Save profile");
const type = async (container: HTMLElement, name: string) =>
  typeInto(nameField(container), name);
const radio = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLInputElement>(
    `input[type="radio"][value="${id}"]`,
  );

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
