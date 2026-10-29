"use client";

import { SceneStage, useChosenScene, useScenes } from "@ador/scenes/react";
import { ArcadeButton, StatusLamp } from "@repo/ui/arcade";
import { useState } from "react";

import { homeCopy } from "../domain/home-copy.ts";

// The first screen: an arcade attract screen. A scene plays edge to edge behind the words, a score line along the bottom says which scene
// is playing (and lets a visitor change it) and how the platform is doing. Only what is true is on it: the number of registered features,
// and launches as gated when that feature exists. The first scene is a random one, chosen after the page has loaded.
export function HomeHero({
  hasCollections,
  hasGames,
  hasLaunches,
  registeredFeatures,
}: {
  readonly hasCollections: boolean;
  readonly hasGames: boolean;
  readonly hasLaunches: boolean;
  readonly registeredFeatures: number;
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
      <SceneStage scene={scene} />
      <div aria-hidden="true" className="home-hero__shade" />
      <div aria-hidden="true" className="home-hero__crt" />
      <div className="home-hero__body">
        <StatusLamp label={homeCopy.eyebrow} tone="attention" />
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
      <div className="home-hero__hud">
        <div className="home-hero__scene">
          <span>{homeCopy.nowPlaying}</span>
          <button
            aria-label={homeCopy.pickPrevious}
            className="home-hero__pick"
            onClick={() => step(-1)}
            type="button"
          >
            ◀
          </button>
          <b aria-live="polite">{scene?.name ?? ""}</b>
          <button
            aria-label={homeCopy.pickNext}
            className="home-hero__pick"
            onClick={() => step(1)}
            type="button"
          >
            ▶
          </button>
        </div>
        <dl className="home-hero__stats">
          <div>
            <dt>{homeCopy.status.featuresLabel}</dt>{" "}
            <dd>
              <b>{homeCopy.status.features(registeredFeatures)}</b>
            </dd>
          </div>
          {hasLaunches ? (
            <div>
              <dt>{homeCopy.status.launchesLabel}</dt>{" "}
              <dd>
                <b>{homeCopy.status.launchesGated}</b>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}
