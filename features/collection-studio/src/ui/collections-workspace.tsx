"use client";

import type { ChainOption } from "@ador/shared/chain";
import { useState } from "react";

import {
  createBrowserServices,
  type CollectionsClientServices,
} from "../client/services.ts";
import { DraftList } from "./components/draft-list.tsx";
import { NewCollection } from "./components/new-collection.tsx";
import { useResource } from "./hooks/use-resource.ts";
import { applyHref } from "./collection-wizard.tsx";

// The client composition root of the collections page: the creator's drafts, and the form that starts
// a new one. Both are plain components that take what they render.
export function CollectionsWorkspace({
  services: provided,
  targetChains,
}: {
  readonly services?: CollectionsClientServices;
  readonly targetChains: readonly ChainOption[];
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const list = useResource((signal) => services.api.list({ signal }), "list");
  return (
    <div className="arcade-stack">
      <DraftList chains={targetChains} list={list} />
      <NewCollection
        applyHref={applyHref}
        chains={targetChains}
        services={services}
      />
    </div>
  );
}
