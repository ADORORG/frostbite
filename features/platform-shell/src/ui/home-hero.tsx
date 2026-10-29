"use client";

import { snowfall } from "@ador/scenes/library";
import { SceneStage, useChosenScene, useScenes } from "@ador/scenes/react";
import { ArcadeButton } from "@repo/ui/arcade";
import { useState } from "react";

import { homeCopy } from "../domain/home-copy.ts";

// The first screen. Snow falls over an icy range behind the words; beside them a small window plays a scene, with two buttons to change it. Words and scene never share pixels, so neither has to be quiet for the other. The buttons are only for what exists. The first
// scene is a random one, chosen after the page has loaded.
export function HomeHero({
  hasCollections,
  hasGames,
  hasLaunches,
}: {
  readonly hasCollections: boolean;
  readonly hasGames: boolean;
  readonly hasLaunches: boolean;
}) {
  const { scenes } = useScenes();
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const scene = useChosenScene(picked);
  const step = (by: number) => {
    const at = scene === null ? 0 : scenes.indexOf(scene);
    setPicked(scenes[(at + by + scenes.length) % scenes.length]?.id);
  };
  return (
    <section aria-label="Welcome" className="home-hero">
      <div aria-hidden="true" className="home-hero__sky">
        <SceneStage scene={snowfall} />
      </div>
      <div aria-hidden="true" className="home-hero__veil" />
      <div className="home-hero__inner">
        <div className="home-hero__copy">
          <h1>
            {homeCopy.headline.first}
            <span>
              {homeCopy.headline.second}
              <i aria-hidden="true" className="home-hero__cursor" />
            </span>
          </h1>
          <p className="home-hero__lede">{homeCopy.lede}</p>
          <div className="home-hero__actions">
            {hasGames ? (
              <ArcadeButton href="/games" tone="red">
                {homeCopy.actions.arcade}
              </ArcadeButton>
            ) : null}
            {hasCollections ? (
              <ArcadeButton href="/collections" tone="cyan">
                {homeCopy.actions.collections}
              </ArcadeButton>
            ) : null}
            {hasLaunches ? (
              <ArcadeButton href="/launches" tone="yellow">
                {homeCopy.actions.launches}
              </ArcadeButton>
            ) : null}
          </div>
        </div>
        <figure className="home-window">
          <div aria-hidden="true" className="home-window__screen">
            <SceneStage scene={scene} />
          </div>
          <div className="home-window__bar">
            <button
              aria-label={homeCopy.pickPrevious}
              className="home-window__pick"
              onClick={() => step(-1)}
              type="button"
            >
              ◀
            </button>
            <b aria-live="polite" className="home-window__name">
              {scene?.name ?? ""}
            </b>
            <button
              aria-label={homeCopy.pickNext}
              className="home-window__pick"
              onClick={() => step(1)}
              type="button"
            >
              ▶
            </button>
          </div>
        </figure>
      </div>
    </section>
  );
}
