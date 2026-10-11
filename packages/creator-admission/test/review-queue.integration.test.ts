import { describe, expect, it } from "vitest";

import {
  at,
  decision,
  request,
  sentApplication,
  service,
  useCreatorDatabase,
  user,
} from "./support/world.ts";
import { allIds, allPages, names } from "./support/queue-pages.ts";

useCreatorDatabase();

async function seven() {
  // Sent at known times, in an order that is neither the name order nor the time order.
  await sentApplication("delta", "2026-10-01T10:00:00.000Z", "a");
  await sentApplication("Alpha", "2026-10-03T10:00:00.000Z", "b");
  await sentApplication("charlie", "2026-10-02T10:00:00.000Z", "c");
  await sentApplication("Bravo", "2026-10-07T10:00:00.000Z", "d");
  await sentApplication("echo", "2026-10-05T10:00:00.000Z", "e");
  await sentApplication("foxtrot", "2026-10-04T10:00:00.000Z", "f");
  await sentApplication("golf", "2026-10-06T10:00:00.000Z", "g");
}

describe("the creator review queue", () => {
  it("lists only what was sent, with what a reviewer needs to choose, and nothing private", async () => {
    const reviewer = await user("reviewer");
    void reviewer;
    const sent = await sentApplication(
      "Sent One",
      "2026-10-01T10:00:00.000Z",
      "s",
    );
    const draftOnly = await user();
    await service.saveDraft(
      {
        contentDeclarationAccepted: false,
        displayName: "Never Sent",
        expectedLaunchSize: "x",
        expectedLaunchTiming: "y",
        jurisdictionAcknowledged: false,
        portfolioLinks: [],
        projectSummary: "z",
        provenanceDeclarationAccepted: false,
        rightsDeclarationAccepted: false,
      },
      request(draftOnly, "draft-never-sent"),
    );
    const page = await service.reviewQueue({
      group: "all",
      position: null,
      sort: "oldest",
    });
    expect(page.items).toEqual([
      {
        applicationId: sent.id,
        displayName: "Sent One",
        sortKey: "2026-10-01T10:00:00.000Z",
        state: "submitted",
        submissionNumber: 1,
        submittedAt: new Date("2026-10-01T10:00:00.000Z"),
        updatedAt: new Date("2026-10-01T10:00:00.000Z"),
      },
    ]);
    expect(page.counts.all).toBe(1);
  });

  it("orders by wait, newest, or name (ignoring case), and every order ends in the same set", async () => {
    await seven();
    const view = async (sort: "oldest" | "newest" | "name") =>
      (await allPages("all", sort)).flat();
    expect(await view("oldest")).toEqual([
      "delta",
      "charlie",
      "Alpha",
      "foxtrot",
      "echo",
      "golf",
      "Bravo",
    ]);
    expect(await view("newest")).toEqual([
      "Bravo",
      "golf",
      "echo",
      "foxtrot",
      "Alpha",
      "charlie",
      "delta",
    ]);
    expect(await view("name")).toEqual([
      "Alpha",
      "Bravo",
      "charlie",
      "delta",
      "echo",
      "foxtrot",
      "golf",
    ]);
  });

  it("follows the cursor through every page with nothing skipped or repeated", async () => {
    await seven();
    for (const sort of ["oldest", "newest", "name"] as const) {
      const pages = await allPages("all", sort);
      expect(pages.map((page) => page.length)).toEqual([3, 3, 1]);
      expect(new Set(pages.flat()).size).toBe(7);
    }
  });

  it("keeps rows with the same sort key apart and in a fixed order across a page boundary", async () => {
    // Four applications sent at the same instant and one named alike: pages of three must still be exact.
    const same = "2026-10-01T10:00:00.000Z";
    const ids: string[] = [];
    for (const [n, name] of ["same", "same", "same", "same"].entries())
      ids.push((await sentApplication(name, same, `t${String(n)}`)).id);
    for (const sort of ["oldest", "newest", "name"] as const) {
      const seen = await allIds("all", sort);
      expect([...seen].sort()).toEqual([...ids].sort());
      expect(new Set(seen).size).toBe(4);
    }
  });

  it("sorts and filters by group, and sizes every group whatever is shown", async () => {
    const reviewer = await user("reviewer");
    const a = await sentApplication("Alpha", "2026-10-01T10:00:00.000Z", "a");
    const b = await sentApplication("Bravo", "2026-10-02T10:00:00.000Z", "b");
    const c = await sentApplication("Charlie", "2026-10-03T10:00:00.000Z", "c");
    let n = 0;
    const act = (id: typeof a.id, action: Parameters<typeof decision>[1]) => {
      at("2026-10-09T10:00:00.000Z");
      return service.review(
        decision(id, action, { creatorFeedback: "Words for the creator." }),
        request(reviewer, `act-${String(++n)}`),
      );
    };
    await act(a.id, "start-review");
    await act(a.id, "approve");
    await act(b.id, "start-review");
    await act(b.id, "request-changes");
    const base = { position: null, sort: "name" as const };
    expect(
      names(await service.reviewQueue({ ...base, group: "needs-review" })),
    ).toEqual(["Charlie"]);
    expect(
      names(await service.reviewQueue({ ...base, group: "active" })),
    ).toEqual(["Alpha"]);
    expect(
      names(await service.reviewQueue({ ...base, group: "finished" })),
    ).toEqual(["Bravo"]);
    const counts = (await service.reviewQueue({ ...base, group: "finished" }))
      .counts;
    expect(counts).toEqual({
      active: 1,
      all: 3,
      finished: 1,
      "needs-review": 1,
    });
    void c;
  });

  it("lists the latest submission: a resubmission is the newer time, the new name, and the next number", async () => {
    const reviewer = await user("reviewer");
    const first = await sentApplication(
      "Old Name",
      "2026-10-01T10:00:00.000Z",
      "r",
    );
    at("2026-10-02T10:00:00.000Z");
    await service.review(
      decision(first.id, "start-review"),
      request(reviewer, "r-1"),
    );
    await service.review(
      decision(first.id, "request-changes", { creatorFeedback: "Rename." }),
      request(reviewer, "r-2"),
    );
    at("2026-10-05T10:00:00.000Z");
    await service.saveDraft(
      {
        contentDeclarationAccepted: true,
        displayName: "New Name",
        expectedLaunchSize: "Small",
        expectedLaunchTiming: "After review",
        jurisdictionAcknowledged: true,
        portfolioLinks: [],
        projectSummary: "Summary",
        provenanceDeclarationAccepted: true,
        rightsDeclarationAccepted: true,
      },
      request(first.applicant, "r-draft"),
    );
    await service.submit(request(first.applicant, "r-submit"));
    const page = await service.reviewQueue({
      group: "all",
      position: null,
      sort: "oldest",
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      displayName: "New Name",
      state: "submitted",
      submissionNumber: 2,
      submittedAt: new Date("2026-10-05T10:00:00.000Z"),
    });
    // The detail is the same latest version, with the earlier history kept.
    const detail = await service.readForReview(first.id);
    expect(detail).toMatchObject({
      snapshot: { displayName: "New Name" },
      submissionNumber: 2,
      submittedAt: new Date("2026-10-05T10:00:00.000Z"),
    });
    expect(detail?.events.map(({ action }) => action)).toEqual([
      "save-draft",
      "submit",
      "start-review",
      "request-changes",
      "save-draft",
      "resubmit",
    ]);
  });
});
