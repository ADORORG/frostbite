import { mount, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { GameSurface, GamesSurface } from "../src/ui/surfaces.tsx";
import { info } from "./support/fixtures.ts";

const navigation = [] as const;

describe("the staff pages", () => {
  it("list the games that declare rewards, with whether each has a contract, and a way in", async () => {
    const withContract = await mount(
      <GamesSurface games={info()} navigation={navigation} />,
    );
    expect(textOf(withContract)).toContain("Rewards contract rewards-1.");
    expect(
      withContract.querySelector("a[href='/admin/games/arcade']")?.textContent,
    ).toBe("Administer Arcade");
    const without = await mount(
      <GamesSurface games={info(false)} navigation={navigation} />,
    );
    expect(textOf(without)).toContain(
      "No rewards contract is deployed for this game",
    );
  });

  it("say so when no game declares rewards", async () => {
    const container = await mount(
      <GamesSurface games={[]} navigation={navigation} />,
    );
    expect(textOf(container)).toContain("Nothing to administer");
  });

  it("show a game's page, with its contract or why it has none, and 'not found' for a game that declares no rewards", async () => {
    const [arcade] = info();
    const page = await mount(
      <GameSurface game={arcade} navigation={navigation} />,
    );
    expect(textOf(page)).toContain("Rewards contract rewards-1 on simnet:one.");
    const none = await mount(
      <GameSurface game={info(false)[0]} navigation={navigation} />,
    );
    expect(textOf(none)).toContain("steps cannot be built yet");
    const missing = await mount(
      <GameSurface game={undefined} navigation={navigation} />,
    );
    expect(textOf(missing)).toContain("Game not found");
    expect(missing.querySelector("a[href='/admin/games']")).not.toBeNull();
  });
});
