import { ApiError } from "@frostbite/client-http";
import { button, click, mount, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { describeFailure } from "../src/client/error-copy.ts";
import { Loadable } from "../src/ui/components/loadable.tsx";
import type { LoadedResource } from "../src/ui/hooks/use-resource.ts";

const failure = describeFailure(new ApiError("network", null, "x"));
const resource = (
  state: LoadedResource<string>["state"],
  reload = vi.fn(),
): LoadedResource<string> => ({ reload, replace: () => undefined, state });
const show = (value: LoadedResource<string>) =>
  mount(
    <Loadable label="your things" resource={value}>
      {(data) => <p>{`Have ${data}`}</p>}
    </Loadable>,
  );

describe("loadable", () => {
  it("says it is loading, then shows what arrived", async () => {
    expect(textOf(await show(resource({ status: "loading" })))).toBe(
      "Loading your things…",
    );
    expect(
      textOf(await show(resource({ data: "stuff", status: "ready" }))),
    ).toBe("Have stuff");
  });

  it("says nothing could be loaded, and offers a retry, when there is nothing to show", async () => {
    const reload = vi.fn();
    const container = await show(
      resource({ data: null, failure, status: "error" }, reload),
    );
    expect(textOf(container)).toContain("Could not load your things.");
    expect(textOf(container)).not.toContain("Have");
    await click(button(container, "Retry"));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("keeps showing what was loaded earlier when a refresh fails, and says so", async () => {
    const container = await show(
      resource({ data: "old", failure, status: "error" }),
    );
    expect(textOf(container)).toContain(
      "Could not refresh your things. Showing what was loaded earlier.",
    );
    expect(textOf(container)).toContain("Have old");
    expect(button(container, "Retry")).not.toBeNull();
  });
});
