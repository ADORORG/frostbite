import { ApiError } from "@frostbite/client-http";
import { button, click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { importFileMaxBytes } from "../src/client/import-parse.ts";
import { ImportItems } from "../src/ui/components/import-items.tsx";
import { useItemImport } from "../src/ui/hooks/use-item-import.ts";
import { detail, imageAsset } from "./support/detail.ts";
import { fakeCollections } from "./support/fake-api.ts";
import { id } from "./support/stubs.ts";

const named = (fileName: string) =>
  imageAsset("collection-item-artwork", id(), { fileName });

function setup(options: { library?: string[]; supply?: number } = {}) {
  const { library = ["one.png", "two.png"], supply = 5 } = options;
  const fake = fakeCollections(
    detail({ plannedSupply: supply }),
    library.map(named),
  );
  const refreshed = vi.fn(async () => undefined);
  function Harness() {
    const importer = useItemImport(
      fake.services,
      fake.state.detail.collection.id,
      refreshed,
    );
    return <ImportItems importer={importer} plannedSupply={supply} />;
  }
  return { ...fake, element: <Harness />, refreshed };
}

async function choose(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("no file input");
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const csv = (text: string, name = "items.csv") =>
  new File([text], name, { type: "text/csv" });
const goodCsv = "name,image,trait:Colour\nOne,one.png,Blue\nTwo,TWO.PNG,Red\n";

describe("importing items from a file", () => {
  it("reads the file, checks it without adding anything, and adds all of it on request", async () => {
    const { api, element, refreshed, state } = setup();
    const container = await mount(element);
    await choose(container, csv(goodCsv));
    await settle(() =>
      expect(textOf(container)).toContain("2 items found, all ready to add."),
    );
    expect(api.importItems).toHaveBeenCalledTimes(1);
    expect(api.importItems.mock.calls[0]?.[0]).toMatchObject({ dryRun: true });
    expect(state.detail.items).toHaveLength(0);
    await click(button(container, "Add 2 items"));
    await settle(() =>
      expect(textOf(container)).toContain("Added 2 items to the collection."),
    );
    expect(api.importItems.mock.calls[1]?.[0]).toMatchObject({
      dryRun: false,
      rows: [
        { attributes: [{ trait: "Colour", value: "Blue" }], name: "One" },
        { imageFileName: "TWO.PNG", name: "Two" },
      ],
    });
    expect(state.detail.items.map(({ name }) => name)).toEqual(["One", "Two"]);
    expect(refreshed).toHaveBeenCalledTimes(1);
    expect(button(container, "Import another file")).not.toBeNull();
  });

  it("names the image it cannot find and offers no way to add until the file is fixed", async () => {
    const { api, element } = setup({ library: ["one.png"] });
    const container = await mount(element);
    await choose(container, csv(goodCsv));
    await settle(() => expect(textOf(container)).toContain("1 to fix"));
    expect(textOf(container)).toContain(
      'None of your uploaded item images is named "TWO.PNG"',
    );
    expect(button(container, "Add 2 items")).toBeNull();
    expect(api.importItems).toHaveBeenCalledTimes(1);
  });

  it("says when the rows would go past the planned supply", async () => {
    const { element } = setup({ supply: 1 });
    const container = await mount(element);
    await choose(container, csv(goodCsv));
    await settle(() =>
      expect(textOf(container)).toContain("go past the planned supply of 1"),
    );
    expect(button(container, "Add 2 items")).toBeNull();
  });

  it("does not ask the server anything while the file itself has problems", async () => {
    const { api, element } = setup();
    const container = await mount(element);
    await choose(container, csv("name,image\n,one.png\nTwo,two.png\n"));
    await settle(() => expect(textOf(container)).toContain("Enter a name"));
    expect(textOf(container)).toContain("2 items found, 1 to fix");
    expect(api.importItems).not.toHaveBeenCalled();
    expect(button(container, "Add 2 items")).toBeNull();
    await choose(container, csv("name,wrong\nx,y"));
    await settle(() =>
      expect(textOf(container)).toContain('The column "wrong" is not one of'),
    );
    expect(api.importItems).not.toHaveBeenCalled();
  });

  it("reads a JSON file of NFT-style metadata", async () => {
    const { api, element } = setup();
    const container = await mount(element);
    await choose(
      container,
      csv(
        JSON.stringify([
          {
            attributes: [{ trait_type: "Colour", value: "Blue" }],
            image: "one.png",
            name: "One",
          },
        ]),
        "items.json",
      ),
    );
    await settle(() =>
      expect(textOf(container)).toContain("1 item found, all ready to add."),
    );
    expect(api.importItems.mock.calls[0]?.[0].rows[0]).toMatchObject({
      attributes: [{ trait: "Colour", value: "Blue" }],
    });
  });

  it("refuses a file that is far too large without reading it", async () => {
    const { api, element } = setup();
    const container = await mount(element);
    const huge = csv(goodCsv);
    Object.defineProperty(huge, "size", { value: importFileMaxBytes + 1 });
    const read = vi.spyOn(huge, "text");
    await choose(container, huge);
    expect(textOf(container)).toContain("This file is too large");
    expect(read).not.toHaveBeenCalled();
    expect(api.importItems).not.toHaveBeenCalled();
  });

  it("says so when the file cannot be read", async () => {
    const { element } = setup();
    const container = await mount(element);
    const broken = csv(goodCsv);
    vi.spyOn(broken, "text").mockRejectedValue(new Error("unreadable"));
    await choose(container, broken);
    await settle(() =>
      expect(textOf(container)).toContain("The file could not be read."),
    );
  });

  it("adds nothing twice: pressing again after a lost answer sends the same key", async () => {
    const { api, element } = setup();
    const container = await mount(element);
    await choose(container, csv(goodCsv));
    await settle(() => expect(button(container, "Add 2 items")).not.toBeNull());
    const original = api.importItems.getMockImplementation();
    api.importItems.mockImplementationOnce(async () => {
      throw new ApiError("network", null, "offline");
    });
    await click(button(container, "Add 2 items"));
    await settle(() =>
      expect(textOf(container)).toContain("could not reach the server"),
    );
    api.importItems.mockImplementation(
      original ??
        (async () => {
          throw new Error("missing");
        }),
    );
    await click(button(container, "Add 2 items"));
    await settle(() => expect(textOf(container)).toContain("Added 2 items"));
    const keys = api.importItems.mock.calls
      .filter(([input]) => !input.dryRun)
      .map(([, options]) => options.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    const dryKey = api.importItems.mock.calls[0]?.[1].idempotencyKey;
    expect(dryKey).not.toBe(keys[0]);
  });

  it("keeps the file's rows on screen, unchecked, when the check itself could not be made", async () => {
    const { api, element } = setup();
    api.importItems.mockRejectedValueOnce(
      new ApiError("network", null, "offline"),
    );
    const container = await mount(element);
    await choose(container, csv(goodCsv));
    await settle(() =>
      expect(textOf(container)).toContain("could not reach the server"),
    );
    expect(textOf(container)).toContain("2 items found.");
    expect(textOf(container)).toContain("Not checked yet.");
    expect(button(container, "Add 2 items")).toBeNull();
  });

  it("shows what changed when the server refuses at the last moment, and adds nothing", async () => {
    const { api, element, state } = setup();
    const container = await mount(element);
    await choose(container, csv(goodCsv));
    await settle(() => expect(button(container, "Add 2 items")).not.toBeNull());
    state.library = [];
    await click(button(container, "Add 2 items"));
    await settle(() => expect(textOf(container)).toContain("2 to fix"));
    expect(textOf(container)).not.toContain("Added");
    expect(state.detail.items).toHaveLength(0);
    expect(api.importItems).toHaveBeenCalledTimes(2);
  });

  it("starts over with a clean slate", async () => {
    const { element } = setup();
    const container = await mount(element);
    expect(button(container, "Start over")).toBeNull();
    await choose(container, csv(goodCsv));
    await settle(() => expect(button(container, "Start over")).not.toBeNull());
    await click(button(container, "Start over"));
    expect(textOf(container)).not.toContain("items found");
    expect(button(container, "Start over")).toBeNull();
  });

  it("offers a template in each format, built from the same columns the reader accepts", async () => {
    const { element } = setup();
    const container = await mount(element);
    const links = [...container.querySelectorAll("a[download]")];
    expect(links.map((link) => link.getAttribute("download"))).toEqual([
      "items-template.csv",
      "items-template.json",
    ]);
    const href = links[0]?.getAttribute("href") ?? "";
    expect(decodeURIComponent(href)).toContain(
      "name,description,image,trait:Background",
    );
  });
});
