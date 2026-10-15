"use client";

import { useState } from "react";

import {
  describeCreatorStanding,
  nextStep,
} from "../client/creator-standing.ts";
import {
  createBrowserServices,
  type CollectionsClientServices,
} from "../client/services.ts";
import { Loadable } from "./components/loadable.tsx";
import { NextStep } from "./components/next-step.tsx";
import {
  CollectionsCard,
  ImagesCard,
  StandingCard,
} from "./components/studio-summary.tsx";
import { useCreatorStanding } from "./hooks/use-creator-standing.ts";
import { useResource } from "./hooks/use-resource.ts";

// The client composition root of the studio home: where the person stands, what they have, and what to
// do next. The three parts load separately, so one that is slow or fails never hides the others.
export function StudioHomeWorkspace({
  services: provided,
}: {
  readonly services?: CollectionsClientServices;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const { resource: standingResource, standing } = useCreatorStanding(services);
  const list = useResource((signal) => services.api.list({ signal }), "list");
  const images = useResource(
    (signal) => services.api.listImages({ signal }),
    "images",
  );
  const collections =
    list.state.status === "ready" ? list.state.data.collections : null;
  const step =
    standingResource.state.status !== "ready"
      ? null
      : nextStep(standingResource.state.data.state, collections);
  return (
    <div className="arcade-stack">
      {step === null ? null : <NextStep step={step} />}
      <ul className="arcade-cards">
        <li>
          <Loadable label="your standing" resource={standingResource}>
            {({ state }) => (
              <StandingCard standing={describeCreatorStanding(state)} />
            )}
          </Loadable>
        </li>
        <li>
          <Loadable label="your collections" resource={list}>
            {({ collections: all }) => (
              <CollectionsCard
                canCreate={standing?.canCreate === true}
                collections={all}
              />
            )}
          </Loadable>
        </li>
        <li>
          <Loadable label="your images" resource={images}>
            {({ assets, nextCursor }) => (
              <ImagesCard assets={assets} truncated={nextCursor !== null} />
            )}
          </Loadable>
        </li>
      </ul>
    </div>
  );
}
