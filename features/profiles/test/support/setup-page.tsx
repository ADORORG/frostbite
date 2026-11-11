import {
  button,
  fieldByLabel,
  mount,
  settle,
  textOf,
  typeInto,
} from "@frostbite/test-kit/dom";
import type { ShareConfig } from "@frostbite/share";
import { expect } from "vitest";

import { ProfileSetup } from "../../src/ui/profile-setup.tsx";
import { fakeApi } from "./profile-api.ts";

export const share: ShareConfig = {
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

// Opens the setup page over a fake server and waits for it to load.
export async function open(api = fakeApi(), shared?: ShareConfig) {
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
export const nameField = (container: HTMLElement) =>
  fieldByLabel(container, "Player name");
export const saveButton = (container: HTMLElement) =>
  button(container, "Save profile");
export const type = async (container: HTMLElement, name: string) =>
  typeInto(nameField(container), name);
export const radio = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLInputElement>(
    `input[type="radio"][value="${id}"]`,
  );
