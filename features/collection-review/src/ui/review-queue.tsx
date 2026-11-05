"use client";

import { collectionReviewActivityPath } from "@frostbite/shared/collections";
import { ArcadeButton, ArcadePanel, ArcadeSelect } from "@repo/ui/arcade";
import { useState } from "react";

import {
  defaultQueueGroup,
  queueGroups,
  type QueueGroup,
} from "../client/queue-groups.ts";
import {
  createBrowserServices,
  type ReviewClientServices,
} from "../client/services.ts";
import { QueueList } from "./components/queue-list.tsx";
import { useResource } from "./hooks/use-resource.ts";

// The client composition root of the queue page: choose a group, read it. Components below take what
// they render.
export function ReviewQueue({
  services: provided,
}: {
  readonly services?: ReviewClientServices;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const [group, setGroup] = useState<QueueGroup>(defaultQueueGroup);
  const list = useResource(
    (signal) => services.api.queue(group.states, { signal }),
    group.id,
  );
  return (
    <ArcadePanel eyebrow="Review queue" title={group.label}>
      <ArcadeSelect
        label="Show"
        onChange={(id) =>
          setGroup(
            queueGroups.find((candidate) => candidate.id === id) ?? group,
          )
        }
        options={queueGroups.map(({ id, label }) => ({ label, value: id }))}
        value={group.id}
      />
      <QueueList list={list} />
      <ArcadeButton href={collectionReviewActivityPath} tone="yellow">
        Activity log
      </ArcadeButton>
    </ArcadePanel>
  );
}
