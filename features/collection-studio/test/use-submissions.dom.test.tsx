import { button, click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it } from "vitest";

import { useSubmissions } from "../src/ui/hooks/use-submissions.ts";
import { fakeCollections } from "./support/fake-api.ts";

type Fake = ReturnType<typeof fakeCollections>;

function Probe({
  fake,
  revision,
}: {
  readonly fake: Fake;
  readonly revision: number;
}) {
  const submissions = useSubmissions(
    fake.services,
    fake.state.detail.collection.id,
  );
  const { state } = submissions.list;
  return (
    <div>
      <p>
        {state.status === "ready"
          ? `listed:${state.data.submissions.length}`
          : state.status}
      </p>
      <p>{submissions.notice?.message ?? "no notice"}</p>
      <button onClick={() => void submissions.submit(revision)} type="button">
        submit
      </button>
    </div>
  );
}

const keysOf = (fake: Fake) =>
  fake.api.submit.mock.calls.map(([, options]) => options.idempotencyKey);

describe("useSubmissions", () => {
  it("loads the collection's submissions, and refreshes them after a submission", async () => {
    const fake = fakeCollections();
    const container = await mount(<Probe fake={fake} revision={1} />);
    await settle(() => expect(textOf(container)).toContain("listed:0"));
    await click(button(container, "submit"));
    await settle(() => expect(textOf(container)).toContain("listed:1"));
  });

  it("uses a fresh key for a later submission of the same revision, because the first one is done", async () => {
    const fake = fakeCollections();
    const container = await mount(<Probe fake={fake} revision={1} />);
    await settle(() => expect(textOf(container)).toContain("listed:0"));
    await click(button(container, "submit"));
    await settle(() => expect(textOf(container)).toContain("listed:1"));
    // A reviewer asked for changes and the creator submits again without editing: a new request.
    await click(button(container, "submit"));
    await settle(() => expect(textOf(container)).toContain("listed:2"));
    const keys = keysOf(fake);
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("keeps the key across a failed attempt", async () => {
    const fake = fakeCollections();
    fake.api.submit.mockRejectedValueOnce(new Error("lost"));
    const container = await mount(<Probe fake={fake} revision={1} />);
    await settle(() => expect(textOf(container)).toContain("listed:0"));
    await click(button(container, "submit"));
    await settle(() =>
      expect(textOf(container)).toContain("Something went wrong"),
    );
    await click(button(container, "submit"));
    await settle(() => expect(textOf(container)).toContain("listed:1"));
    const keys = keysOf(fake);
    expect(keys[1]).toBe(keys[0]);
  });
});
