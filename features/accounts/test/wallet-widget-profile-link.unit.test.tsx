// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  address,
  answers,
  asks,
  connection,
  container,
  denied,
  json,
  openMenu,
  setSession,
  settle,
  show,
} from "./support/widget-harness.tsx";

const profilePath = "/api/v1/profile";
const policy = { changeCooldownDays: 30, maxLength: 32, minLength: 3 };
const profile = (visible: boolean) => ({
  policy,
  profile: {
    avatar: "snowman",
    canChangeNameAt: null,
    memberSince: "2026-10-13T12:00:00.000Z",
    name: "glitchy_1",
    visible,
  },
});
const link = () =>
  container.querySelector<HTMLAnchorElement>(".wallet-menu a[href^='/p']") ??
  [...container.querySelectorAll<HTMLAnchorElement>(".wallet-menu a")].find(
    (a) => a.textContent === "My profile",
  );

async function openSignedIn() {
  setSession("signed-in");
  Object.assign(connection, { address, connected: true });
  await show();
  await settle();
  await openMenu();
}

describe("the wallet menu: where My profile leads", () => {
  it("leads to the public page when the player has one and it is shown", async () => {
    answers[profilePath] = () => json(profile(true));
    await openSignedIn();
    expect(link()?.getAttribute("href")).toBe("/p/glitchy_1");
  });

  it("leads to the setup page when the public page is switched off, since it would answer not found", async () => {
    answers[profilePath] = () => json(profile(false));
    await openSignedIn();
    expect(asks(profilePath)).toHaveLength(1);
    expect(link()?.getAttribute("href")).toBe("/profile");
  });

  it("leads to the setup page when there is no profile yet", async () => {
    answers[profilePath] = () => json({ policy, profile: null });
    await openSignedIn();
    expect(link()?.getAttribute("href")).toBe("/profile");
  });

  it("stays on the setup page when the profile cannot be read", async () => {
    answers[profilePath] = () => denied("internal", 500);
    await openSignedIn();
    expect(link()?.getAttribute("href")).toBe("/profile");
  });

  it("does not ask for a profile when nobody is signed in", async () => {
    Object.assign(connection, { address, connected: true });
    await show();
    await settle();
    await openMenu();
    expect(asks(profilePath)).toHaveLength(0);
  });
});
