import { ApiError } from "@ador/client-http";
import { click, mount, settle, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { useCreatorStanding } from "../src/ui/hooks/use-creator-standing.ts";
import { fakeCollections } from "./support/fake-api.ts";

// A page that shows what the hook knows, and a button that asks it to load again.
function Probe({
  services,
}: {
  readonly services: ReturnType<typeof fakeCollections>["services"];
}) {
  const { resource, standing } = useCreatorStanding(services);
  return (
    <div>
      <p>{standing === null ? "unknown" : standing.headline}</p>
      <button onClick={resource.reload} type="button">
        again
      </button>
    </div>
  );
}

describe("creator standing, as the pages see it", () => {
  it("is unknown while loading", async () => {
    const fake = fakeCollections();
    fake.api.creatorStanding.mockReturnValueOnce(new Promise(() => undefined));
    const container = await mount(<Probe services={fake.services} />);
    expect(textOf(container)).toContain("unknown");
  });

  it("says where the person stands once it has loaded", async () => {
    const fake = fakeCollections();
    fake.state.standing = "under-review";
    const container = await mount(<Probe services={fake.services} />);
    await settle(() =>
      expect(textOf(container)).toContain("Application in review"),
    );
    expect(textOf(container)).not.toContain("unknown");
  });

  it("is unknown when it could not be loaded at all", async () => {
    const fake = fakeCollections();
    fake.api.creatorStanding.mockRejectedValue(
      new ApiError("network", null, "x"),
    );
    const container = await mount(<Probe services={fake.services} />);
    await settle(() => expect(fake.api.creatorStanding).toHaveBeenCalled());
    expect(textOf(container)).toContain("unknown");
  });

  it("keeps what it last knew when a refresh fails, rather than forgetting", async () => {
    const fake = fakeCollections();
    const container = await mount(<Probe services={fake.services} />);
    await settle(() => expect(textOf(container)).toContain("Approved creator"));
    fake.api.creatorStanding.mockRejectedValueOnce(
      new ApiError("network", null, "x"),
    );
    await click(container.querySelector("button"));
    await settle(() =>
      expect(fake.api.creatorStanding).toHaveBeenCalledTimes(2),
    );
    expect(textOf(container)).toContain("Approved creator");
  });

  it("knows a person who never applied, which is an answer and not a missing one", async () => {
    const fake = fakeCollections();
    fake.state.standing = null;
    const container = await mount(<Probe services={fake.services} />);
    await settle(() =>
      expect(textOf(container)).toContain("Not a creator yet"),
    );
  });
});
