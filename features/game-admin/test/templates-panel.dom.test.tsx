import {
  button,
  click,
  fieldByLabel,
  mount,
  settle,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import type { ListGameAdminTemplatesResponse } from "@ador/shared/games";
import { describe, expect, it, vi } from "vitest";

import { TemplatesPanel } from "../src/ui/templates-panel.tsx";
import { fakeApi, publishable, publishing } from "./support/fake-api.ts";

const published = [
  {
    address: "at-1",
    publishedAt: "2026-10-16T12:00:00.000Z",
    templateRef: "game-rewards@1.0.0",
  },
];
const api = (over: Parameters<typeof fakeApi>[0] = {}) => fakeApi(over);
const enterWallet = (container: HTMLElement) =>
  typeInto(fieldByLabel(container, "Wallet address"), "sim:one:a1b2c3fe");

describe("the templates staff publish", () => {
  it("says it is loading, then lists each template with whether and where it is published", async () => {
    let release: () => void = () => undefined;
    const container = await mount(
      <TemplatesPanel
        api={api({
          templates: vi.fn(
            () =>
              new Promise<ListGameAdminTemplatesResponse>((resolve) => {
                release = () => resolve({ publishable, published, steps: [] });
              }),
          ),
        })}
      />,
    );
    expect(textOf(container)).toContain("Loading the templates");
    expect(button(container, "Publish game-rewards@1.0.0")).toBeNull();
    release();
    await settle(() =>
      expect(textOf(container)).toContain("Published at at-1"),
    );
    const items = [...container.querySelectorAll("[data-template]")];
    expect(items.map((item) => item.getAttribute("data-template"))).toEqual([
      "game-rewards@1.0.0",
      "milestone-collectible@1.0.0",
    ]);
    expect(items[0]?.textContent).not.toContain("Not published");
    expect(items[1]?.textContent).toContain("Not published");
    // A published template has nothing left to publish; the other has a field and a button.
    expect(button(container, "Publish game-rewards@1.0.0")).toBeNull();
    expect(
      button(container, "Publish milestone-collectible@1.0.0"),
    ).not.toBeNull();
    expect(textOf(container)).not.toContain("Auth token output");
    expect(textOf(container)).toContain("No template has been published yet.");
  });

  it("says why it cannot show the templates when the platform cannot be reached", async () => {
    const container = await mount(
      <TemplatesPanel
        api={api({
          templates: vi.fn(async () => {
            throw new Error("down");
          }),
        })}
      />,
    );
    await settle(() =>
      expect(textOf(container)).toContain("The platform could not be reached"),
    );
  });

  it("publishes a template at the address staff typed, once they say who signs", async () => {
    const fake = api();
    const container = await mount(<TemplatesPanel api={fake} />);
    await settle(() =>
      expect(button(container, "Publish game-rewards@1.0.0")).not.toBeNull(),
    );
    const publish = () => button(container, "Publish game-rewards@1.0.0");
    expect(publish()?.disabled).toBe(true);
    await enterWallet(container);
    expect(publish()?.disabled).toBe(true);
    await typeInto(
      fieldByLabel(container, "Address for game-rewards@1.0.0"),
      " 4:100 ",
    );
    expect(publish()?.disabled).toBe(false);
    fake.start = vi.fn(async () => ({
      resumed: false,
      status: "started" as const,
      step: publishing(),
    }));
    await click(publish());
    expect(fake.start).toHaveBeenCalledWith({
      action: {
        address: "4:100",
        operation: "publish-template",
        templateId: "game-rewards",
        templateVersion: "1.0.0",
      },
      gameId: null,
      wallet: "sim:one:a1b2c3fe",
    });
    const review = container.querySelector('[data-testid="step-review"]');
    expect(review?.textContent).toContain(
      "Publish template game-rewards@1.0.0",
    );
    expect(review?.textContent).toContain("game-rewards 1.0.0 at at-1");
    expect(review?.textContent).not.toContain("Rewards contract");
  });

  it("keeps an address typed for one template from being used for another", async () => {
    const fake = api();
    const container = await mount(<TemplatesPanel api={fake} />);
    await settle(() =>
      expect(button(container, "Publish game-rewards@1.0.0")).not.toBeNull(),
    );
    await enterWallet(container);
    await typeInto(
      fieldByLabel(container, "Address for game-rewards@1.0.0"),
      "4:100",
    );
    expect(
      button(container, "Publish milestone-collectible@1.0.0")?.disabled,
    ).toBe(true);
  });

  it("says why a template was refused, and shows the log of the steps that published templates", async () => {
    const fake = api({
      start: vi.fn(async () => ({
        reason: "address-taken" as const,
        status: "refused" as const,
      })),
      templates: vi.fn(async () => ({
        publishable,
        published: [],
        steps: [
          publishing({ state: "complete", submittedBy: "Grace", toSign: null }),
        ],
      })),
    });
    const container = await mount(<TemplatesPanel api={fake} />);
    await settle(() => expect(textOf(container)).toContain("Template log"));
    expect(textOf(container)).toContain("Publish template game-rewards@1.0.0");
    expect(textOf(container)).toContain("sent by Grace");
    await enterWallet(container);
    await typeInto(
      fieldByLabel(container, "Address for milestone-collectible@1.0.0"),
      "at-1",
    );
    await click(button(container, "Publish milestone-collectible@1.0.0"));
    expect(textOf(container)).toContain("already holds a template");
  });
});
