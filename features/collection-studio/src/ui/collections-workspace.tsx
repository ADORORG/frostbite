"use client";

import type { ChainOption } from "@ador/shared/chain";
import { collectionNewPath } from "@ador/shared/collections";
import { ArcadeButton } from "@repo/ui/arcade";
import { useState } from "react";

import {
  createBrowserServices,
  type CollectionsClientServices,
} from "../client/services.ts";
import { ApprovalNotice } from "./components/approval-notice.tsx";
import { CollectionList } from "./components/collection-list.tsx";
import { useCreatorStanding } from "./hooks/use-creator-standing.ts";
import { useResource } from "./hooks/use-resource.ts";

// The client composition root of the collections overview: the creator's collections, and the way to
// start one. A person who cannot build collections yet is told why instead of being offered a button
// that would be refused; if their standing cannot be read, the button stays and the server decides.
export function CollectionsWorkspace({
  services: provided,
  targetChains,
}: {
  readonly services?: CollectionsClientServices;
  readonly targetChains: readonly ChainOption[];
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const { standing } = useCreatorStanding(services);
  const list = useResource((signal) => services.api.list({ signal }), "list");
  return (
    <div className="arcade-stack">
      {standing !== null && !standing.canCreate ? (
        <ApprovalNotice standing={standing} />
      ) : (
        <div className="page-actions">
          <ArcadeButton href={collectionNewPath} tone="mint">
            New collection
          </ArcadeButton>
        </div>
      )}
      <CollectionList chains={targetChains} list={list} />
    </div>
  );
}
