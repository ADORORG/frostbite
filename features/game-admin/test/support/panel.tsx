import { fieldByLabel, mount, typeInto } from "@ador/test-kit/dom";

import { GameAdminPanel } from "../../src/ui/game-admin-panel.tsx";
import { info } from "./fixtures.ts";
import { fakeApi } from "./fake-api.ts";

const arcade = () => {
  const found = info()[0];
  if (found === undefined) throw new Error("no game");
  return found;
};

// The panel for the arcade game over a fake API, mounted.
export async function panel(
  api = fakeApi(),
  extra: Partial<Parameters<typeof GameAdminPanel>[0]> = {},
) {
  return mount(<GameAdminPanel api={api} game={arcade()} {...extra} />);
}

export const enterWallet = (
  container: HTMLElement,
  value = "sim:one:a1b2c3fe",
) => typeInto(fieldByLabel(container, "Wallet address"), value);
