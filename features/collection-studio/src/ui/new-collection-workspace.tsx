"use client";

import type { ChainOption } from "@ador/shared/chain";
import { creatorApplicationPath } from "@ador/shared/creator-admission";
import { StatusLamp } from "@repo/ui/arcade";
import { useState } from "react";

import {
  createBrowserServices,
  type CollectionsClientServices,
} from "../client/services.ts";
import { ApprovalNotice } from "./components/approval-notice.tsx";
import { NewCollection } from "./components/new-collection.tsx";
import { useCreatorStanding } from "./hooks/use-creator-standing.ts";

// The client composition root of the page that starts a collection. A person who cannot build
// collections yet sees why, not a form that would be refused; if their standing cannot be read, the
// form is shown and the server decides.
export function NewCollectionWorkspace({
  services: provided,
  targetChains,
}: {
  readonly services?: CollectionsClientServices;
  readonly targetChains: readonly ChainOption[];
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const { resource, standing } = useCreatorStanding(services);
  if (resource.state.status === "loading")
    return (
      <StatusLamp label="Checking your creator status…" tone="attention" />
    );
  if (standing !== null && !standing.canCreate)
    return <ApprovalNotice standing={standing} />;
  return (
    <NewCollection
      applyHref={creatorApplicationPath}
      chains={targetChains}
      services={services}
    />
  );
}
