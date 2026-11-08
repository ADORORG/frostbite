import { ScenesProvider } from "@frostbite/scenes/react";
import type { ShareConfig } from "@frostbite/share";
import type { PublicProfileView } from "@frostbite/shared/profiles";
import { button, mount, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it } from "vitest";

import { publicProfileModel } from "../src/domain/public-model.ts";
import { PlayerCard } from "../src/ui/player-card.tsx";
import { ProfileNotFound, PublicProfile } from "../src/ui/public-profile.tsx";
import { runner, stacker } from "./support/games.ts";

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
const claim = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const full: PublicProfileView = {
  avatar: "fox",
  bests: [
    {
      achievedAt: "2026-11-06T10:00:00.000Z",
      gameId: "frost-runner",
      score: 18_420,
    },
    {
      achievedAt: "2026-11-04T10:00:00.000Z",
      gameId: "tower-stack",
      score: 87,
    },
  ],
  memberSince: "2026-10-01T00:00:00.000Z",
  mints: [
    {
      claimId: claim,
      gameId: "frost-runner",
      milestoneId: "first-run",
      mintedAt: "2026-11-05T10:00:00.000Z",
    },
  ],
  name: "IceAda",
};
const show = (view: PublicProfileView, shared?: ShareConfig) =>
  mount(
    <ScenesProvider>
      <PublicProfile
        model={publicProfileModel(view, [runner, stacker])}
        navigation={[]}
        {...(shared === undefined ? {} : { share: shared })}
      />
    </ScenesProvider>,
  );

describe("a player's public page", () => {
  it("shows the card: the name, the exact page address, when they joined, and the counts", async () => {
    const container = await show(full);
    const text = textOf(container);
    expect(text).toContain("IceAda");
    expect(text).toContain("/p/IceAda");
    expect(text).toContain("Joined Oct 2026");
    expect(
      container.querySelector(".player-card__stats")?.textContent,
    ).toContain("2verified bests");
    expect(
      container.querySelector(".player-card__stats")?.textContent,
    ).toContain("1milestone minted");
  });

  it("shows each verified high score with its game, when it was set, a verified badge and a way to answer it", async () => {
    const container = await show(full);
    const tiles = [...container.querySelectorAll(".score-tile")];
    expect(tiles).toHaveLength(2);
    expect(tiles[0]?.textContent).toContain("Frost Runner");
    expect(tiles[0]?.textContent).toContain("18,420");
    expect(tiles[0]?.textContent).toContain("Verified");
    expect(tiles[0]?.textContent).toContain("Set Nov 6, 2026");
    expect(tiles[0]?.querySelector("a")?.getAttribute("href")).toBe(
      "/games/frost-runner",
    );
    expect(tiles[0]?.querySelector("a")?.getAttribute("aria-label")).toBe(
      "Beat it: Frost Runner",
    );
    expect(
      container.querySelector(".profile-highlight")?.textContent,
    ).toContain("18,420");
  });

  it("shows each minted milestone by its title with its game, its picture asked of the public gallery", async () => {
    const container = await show(full);
    const item = container.querySelector(".mint-shelf__item");
    expect(item?.textContent).toContain("First Run");
    expect(item?.textContent).toContain("Frost Runner");
    expect(item?.querySelector("img")?.getAttribute("src")).toBe(
      `/api/v1/games/gallery/picture?claimId=${claim}`,
    );
  });

  it("says plainly when there are no scores and no mints, and has no highlight", async () => {
    const container = await show({ ...full, bests: [], mints: [] });
    const text = textOf(container);
    expect(text).toContain("No verified scores yet");
    expect(text).toContain("Nothing minted yet");
    expect(container.querySelector(".profile-highlight")).toBeNull();
    expect(container.querySelectorAll(".score-tile")).toHaveLength(0);
  });

  it("offers to share the page when sharing is configured, and not otherwise", async () => {
    expect(button(await show(full, share), "Share")).not.toBeNull();
    expect(button(await show(full), "Share")).toBeNull();
  });

  it("invites a visitor to browse games and make their own card", async () => {
    const container = await show(full);
    expect(container.querySelector('a[href="/games"]')).not.toBeNull();
    expect(container.querySelector('a[href="/profile"]')).not.toBeNull();
  });
});

describe("the page for a name nobody shows", () => {
  it("says there is no player there, without saying whether the name is hidden or free", async () => {
    const container = await mount(<ProfileNotFound navigation={[]} />);
    expect(textOf(container)).toContain("No player here");
    expect(container.querySelector('a[href="/games"]')).not.toBeNull();
    expect(container.querySelector('a[href="/profile"]')).not.toBeNull();
  });
});

describe("the player card", () => {
  it("keeps the picture decorative, and shows the placeholder, dimmed, while there is no name", async () => {
    const container = await mount(<PlayerCard avatar="ghost" name="" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(
      container.querySelector(".player-card__name")?.getAttribute("data-empty"),
    ).toBe("true");
    expect(textOf(container)).toContain("Your name");
    expect(container.querySelector(".player-card__handle")).toBeNull();
  });

  it("lights itself in the colour of its picture", async () => {
    const container = await mount(<PlayerCard avatar="alien" name="Zed" />);
    expect(
      container
        .querySelector<HTMLElement>(".player-card")
        ?.style.getPropertyValue("--card-accent"),
    ).toBe("#4dffa8");
  });
});
