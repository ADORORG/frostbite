"use client";

import type { ChainOption } from "@ador/shared/chain";
import { useState } from "react";

import {
  createBrowserServices,
  type CollectionsClientServices,
} from "../client/services.ts";
import { applyHref } from "./collection-wizard.tsx";
import { NewCollection } from "./components/new-collection.tsx";

// The client composition root of the page that starts a collection.
export function NewCollectionWorkspace({
  services: provided,
  targetChains,
}: {
  readonly services?: CollectionsClientServices;
  readonly targetChains: readonly ChainOption[];
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  return (
    <NewCollection
      applyHref={applyHref}
      chains={targetChains}
      services={services}
    />
  );
}
