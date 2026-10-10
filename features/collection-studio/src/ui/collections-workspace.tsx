"use client";

import type { ChainOption } from "@ador/shared/chain";
import { useState } from "react";

import {
  createBrowserServices,
  type CollectionsClientServices,
} from "../client/services.ts";
import { CollectionList } from "./components/collection-list.tsx";
import { useResource } from "./hooks/use-resource.ts";

// The client composition root of the collections overview: the creator's collections, loaded in the
// browser. Starting one is a page of its own.
export function CollectionsWorkspace({
  services: provided,
  targetChains,
}: {
  readonly services?: CollectionsClientServices;
  readonly targetChains: readonly ChainOption[];
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const list = useResource((signal) => services.api.list({ signal }), "list");
  return <CollectionList chains={targetChains} list={list} />;
}
