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

import { FeeSettingsBoundary } from "../src/ui/fee-settings.tsx";
import { TemplatesPanel } from "../src/ui/templates-panel.tsx";
import {
  apiError,
  fakeApi,
  publishable,
  publishing,
} from "./support/fake-api.ts";

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
            throw apiError("network");
          }),
        })}
      />,
    );
    await settle(() =>
      expect(textOf(container)).toContain(
        "The platform could not be reached while loading the steps",
      ),
    );
  });

  it("publishes a template once they say who signs, without asking for an address, and shows the one the platform chose", async () => {
    const fake = api();
    const container = await mount(<TemplatesPanel api={fake} />);
    await settle(() =>
      expect(button(container, "Publish game-rewards@1.0.0")).not.toBeNull(),
    );
    const publish = () => button(container, "Publish game-rewards@1.0.0");
    // The platform finds the address; there is nothing to type for it.
    expect(container.textContent).not.toContain("Address for");
    expect(container.querySelectorAll("input")).toHaveLength(1);
    expect(publish()?.disabled).toBe(true);
    await enterWallet(container);
    expect(publish()?.disabled).toBe(false);
    fake.start = vi.fn(async () => ({
      resumed: false,
      status: "started" as const,
      step: publishing(),
    }));
    await click(publish());
    expect(fake.start).toHaveBeenCalledWith({
      action: {
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

  it("says why a template was refused, and shows the log of the steps that published templates", async () => {
    const fake = api({
      start: vi.fn(async () => ({
        reason: "already-published" as const,
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
    await click(button(container, "Publish milestone-collectible@1.0.0"));
    expect(textOf(container)).toContain("This template is already published.");
  });
});

describe("choosing how fast a template is published", () => {
  const quotes = [
    { approxMinutes: 250, satPerVb: 1.009, speed: "slow", targetBlocks: 25 },
    { approxMinutes: 60, satPerVb: 3, speed: "medium", targetBlocks: 6 },
    { approxMinutes: 30, satPerVb: 5, speed: "fast", targetBlocks: 3 },
    { approxMinutes: 15, satPerVb: 9, speed: "lightning", targetBlocks: 1 },
  ] as const;
  const feesApi = {
    fees: async () => ({
      chain: "Bitcoin testnet4",
      observedAt: "2026-10-23T12:00:00.000Z",
      quotes: [...quotes],
      state: "ok" as const,
      tipHeight: 157_401,
    }),
    indexing: () => Promise.reject(new Error("not used")),
  };

  it("offers the speeds with the chain's rates, starts on the usual one, and sends the one chosen with the step", async () => {
    const fake = api();
    fake.start = vi.fn(async () => ({
      resumed: false,
      status: "started" as const,
      step: publishing(),
    }));
    const container = await mount(
      <FeeSettingsBoundary
        settings={{ api: feesApi, defaultSpeed: "slow", refreshMs: 60_000 }}
      >
        <TemplatesPanel api={fake} />
      </FeeSettingsBoundary>,
    );
    await settle(() =>
      expect(button(container, "Publish game-rewards@1.0.0")).not.toBeNull(),
    );
    await settle(() => expect(textOf(container)).toContain("9.00 sat/vB"));
    const radios = [
      ...container.querySelectorAll<HTMLInputElement>("input[type=radio]"),
    ];
    expect(radios.map((radio) => [radio.value, radio.checked])).toEqual([
      ["slow", true],
      ["medium", false],
      ["fast", false],
      ["lightning", false],
    ]);
    await enterWallet(container);
    await click(button(container, "Publish game-rewards@1.0.0"));
    expect(fake.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ feeSpeed: "slow" }),
    );
    await click(radios[2] ?? null);
    await click(button(container, "Publish game-rewards@1.0.0"));
    expect(fake.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ feeSpeed: "fast" }),
    );
  });

  it("sends no speed, and offers no picker, where the page was given no fee settings", async () => {
    const fake = api();
    const container = await mount(<TemplatesPanel api={fake} />);
    await settle(() =>
      expect(button(container, "Publish game-rewards@1.0.0")).not.toBeNull(),
    );
    expect(container.querySelector("input[type=radio]")).toBeNull();
    await enterWallet(container);
    await click(button(container, "Publish game-rewards@1.0.0"));
    const asked = vi.mocked(fake.start).mock.calls.at(-1)?.[0];
    expect(asked).not.toHaveProperty("feeSpeed");
  });
});
