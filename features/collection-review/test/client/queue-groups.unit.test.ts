import { submissionStates } from "@ador/shared/collections";
import { describe, expect, it } from "vitest";

import {
  defaultQueueGroup,
  queueGroups,
} from "../../src/client/queue-groups.ts";

describe("queue groups", () => {
  it("cover every state exactly once, so nothing can be hidden from the queue", () => {
    const covered = queueGroups.flatMap(({ states }) => [...states]);
    expect([...covered].sort()).toEqual([...submissionStates].sort());
  });

  it("start with what needs a reviewer, and have distinct ids and labels", () => {
    expect(defaultQueueGroup.id).toBe("needs-review");
    expect(defaultQueueGroup.states).toEqual(["submitted", "under-review"]);
    expect(new Set(queueGroups.map(({ id }) => id)).size).toBe(
      queueGroups.length,
    );
    expect(new Set(queueGroups.map(({ label }) => label)).size).toBe(
      queueGroups.length,
    );
  });
});
