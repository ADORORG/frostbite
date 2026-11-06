import { mount, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it } from "vitest";

import { DetailSurface } from "../src/ui/detail-surface.tsx";
import { QueueSurface } from "../src/ui/queue-surface.tsx";

const navigation = [
  {
    area: "admin",
    current: "page",
    href: "/admin/collection-reviews",
    label: "Collection reviews",
  },
] as const;

describe("review page surfaces", () => {
  it("frames the queue in the platform shell and says nothing here publishes", async () => {
    const container = await mount(<QueueSurface navigation={navigation} />);
    expect(container.querySelector("h1")?.textContent).toBe(
      "Collection reviews",
    );
    expect(textOf(container)).not.toContain("STAFF ONLY");
    expect(container.querySelector(".arcade-eyebrow")?.textContent).toBe(
      "Admin",
    );
    expect(textOf(container)).toContain("Collection reviews");
    expect(textOf(container)).toContain(
      "Nothing here publishes or deploys anything.",
    );
    expect(
      container.querySelector('a[href="/admin/collection-reviews"]'),
    ).not.toBeNull();
  });

  it("frames the detail page and says the frozen version does not change when the draft does", async () => {
    const container = await mount(
      <DetailSurface
        navigation={navigation}
        submissionId="018f22f2-9c1a-7b21-8c45-0000000000aa"
      />,
    );
    expect(container.querySelector("h1")?.textContent).toBe(
      "Review a submission",
    );
    expect(textOf(container)).toContain(
      "Editing the draft later does not change it.",
    );
  });
});
