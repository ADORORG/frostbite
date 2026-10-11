import { chainOptionSchema } from "@ador/shared/chain";
import {
  chooseOption,
  click,
  button,
  fieldByLabel,
  mount,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { newDraftForm } from "../src/client/draft-form.ts";
import { ImagesStep } from "../src/ui/components/images-step.tsx";
import { NewCollection } from "../src/ui/components/new-collection.tsx";
import {
  DetailsFields,
  SupplyFields,
} from "../src/ui/components/step-fields.tsx";
import { fakeCollections } from "./support/fake-api.ts";
import { imageAsset } from "./support/detail.ts";
import { ApiError } from "@ador/client-http";
import { signet } from "./support/stubs.ts";

const chain = chainOptionSchema.parse({
  chainId: signet,
  displayName: "Bitcoin signet",
  enabled: true,
  family: "bitcoin-alkanes",
  role: "public-beta",
});

describe("draft fields", () => {
  it("reports each details field as it is edited", async () => {
    const onChange = vi.fn();
    const container = await mount(
      <DetailsFields
        disabled={false}
        errors={{}}
        form={newDraftForm(signet)}
        onChange={onChange}
      />,
    );
    await typeInto(fieldByLabel(container, "Collection name"), "A");
    await typeInto(fieldByLabel(container, "Description"), "B");
    await typeInto(fieldByLabel(container, "Provenance"), "C");
    expect(
      onChange.mock.calls.map(([change]) => Object.keys(change)[0]),
    ).toEqual(["name", "description", "provenance"]);
  });

  it("shows only the name when asked, for starting a draft", async () => {
    const container = await mount(
      <DetailsFields
        disabled={false}
        errors={{}}
        form={newDraftForm(signet)}
        onChange={() => undefined}
        only="name"
      />,
    );
    expect(container.querySelectorAll("input, textarea")).toHaveLength(1);
  });

  it("reports the supply and the chain, shows a chain error, and keeps a chain that is no longer offered", async () => {
    const onChange = vi.fn();
    const container = await mount(
      <SupplyFields
        chains={[chain]}
        disabled={false}
        errors={{ targetChain: "Choose a chain." }}
        form={newDraftForm("eip155:1")}
        onChange={onChange}
      />,
    );
    await typeInto(fieldByLabel(container, "Planned supply"), "7");
    expect(onChange).toHaveBeenLastCalledWith({ plannedSupply: "7" });
    const select = fieldByLabel(container, "Target chain");
    expect(
      [...select.querySelectorAll("option")].map(
        (option) => option.textContent,
      ),
    ).toEqual(["Bitcoin signet", "eip155:1 (no longer available)"]);
    expect(select.value).toBe("eip155:1");
    expect(textOf(container)).toContain("Choose a chain.");
    await chooseOption(container, signet);
    expect(onChange).toHaveBeenLastCalledWith({ targetChain: signet });
  });
});

describe("images step choices", () => {
  it("reports a chosen cover and a chosen banner", async () => {
    const onChange = vi.fn();
    const cover = imageAsset("collection-artwork");
    const banner = imageAsset("collection-banner");
    const container = await mount(
      <ImagesStep
        disabled={false}
        form={newDraftForm(signet)}
        library={{
          data: { assets: [cover, banner], truncated: false },
          status: "ready",
        }}
        onChange={onChange}
        onRefresh={() => undefined}
        onUploaded={async () => undefined}
      />,
    );
    const radios = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ];
    // None and the cover choice, then None and the banner choice.
    await act(() => radios[1]?.click());
    await act(() => radios[3]?.click());
    expect(onChange.mock.calls.map(([change]) => change)).toEqual([
      { coverAssetId: cover.id },
      { bannerAssetId: banner.id },
    ]);
  });
});

describe("new collection", () => {
  it("lets a failure notice be dismissed or reloaded away", async () => {
    const fake = fakeCollections();
    fake.api.create.mockRejectedValue(
      new ApiError("conflict", 409, "Changed."),
    );
    const container = await mount(
      <NewCollection
        applyHref="/apply"
        chains={[chain]}
        services={fake.services}
      />,
    );
    await typeInto(fieldByLabel(container, "Collection name"), "x");
    await typeInto(fieldByLabel(container, "Planned supply"), "2");
    await click(button(container, "Create collection"));
    await click(button(container, "Reload the draft"));
    expect(textOf(container)).not.toContain("Changed.");
    await click(button(container, "Create collection"));
    await click(button(container, "Dismiss"));
    expect(textOf(container)).not.toContain("Changed.");
  });
});
