import { describe, expect, it, vi } from "vitest";

import { BulkUpload } from "../src/ui/bulk-upload.tsx";
import {
  button,
  chooseFiles,
  click,
  imageFile,
  mount,
  settle,
  textOf,
} from "./support/dom.tsx";
import { batchServices, names } from "./support/bulk-fixtures.ts";

describe("bulk upload", () => {
  it("sends every file under its own name and reports each image once it is processed", async () => {
    const { created, services } = batchServices();
    const onProcessed = vi.fn();
    const container = await mount(
      <BulkUpload
        onProcessed={onProcessed}
        purpose="collection-item-artwork"
        services={services}
      />,
    );
    await chooseFiles(
      container,
      names(4).map((name) => imageFile(3, "image/png", name)),
    );
    await settle(() => expect(textOf(container)).toContain("4 of 4 ready."));
    expect(created.map(({ fileName }) => fileName)).toEqual(names(4));
    expect(new Set(created.map(({ key }) => key)).size).toBe(4);
    expect(onProcessed).toHaveBeenCalledTimes(4);
    expect(onProcessed.mock.calls.map(([, name]) => name).sort()).toEqual(
      names(4),
    );
  });

  it("tells the page once when the whole batch is at rest, not once per image", async () => {
    const { services } = batchServices();
    const onSettled = vi.fn();
    const container = await mount(
      <BulkUpload
        onSettled={onSettled}
        purpose="collection-item-artwork"
        services={services}
      />,
    );
    expect(onSettled).not.toHaveBeenCalled();
    await chooseFiles(
      container,
      names(4).map((name) => imageFile(3, "image/png", name)),
    );
    await settle(() => expect(textOf(container)).toContain("4 of 4 ready."));
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("refuses a file that cannot be used without starting it, and uploads the rest", async () => {
    const { created, services } = batchServices();
    const container = await mount(
      <BulkUpload purpose="collection-item-artwork" services={services} />,
    );
    await chooseFiles(container, [
      imageFile(3, "image/png", "good.png"),
      imageFile(3, "image/gif", "moving.gif"),
    ]);
    await settle(() =>
      expect(textOf(container)).toContain("1 of 2 ready, 1 not accepted."),
    );
    expect(textOf(container)).toContain("moving.gif");
    expect(created.map(({ fileName }) => fileName)).toEqual(["good.png"]);
  });

  it("lets one failure stand while the others finish, and retries it with the same key", async () => {
    let failing = true;
    const { created, services } = batchServices({
      fail: (name) => failing && name === "piece-2.png",
    });
    const container = await mount(
      <BulkUpload purpose="collection-item-artwork" services={services} />,
    );
    await chooseFiles(
      container,
      names(3).map((name) => imageFile(3, "image/png", name)),
    );
    await settle(() =>
      expect(textOf(container)).toContain("2 of 3 ready, 1 can be retried."),
    );
    failing = false;
    await click(button(container, "Retry piece-2.png"));
    await settle(() => expect(textOf(container)).toContain("3 of 3 ready."));
    const attempts = created.filter(
      ({ fileName }) => fileName === "piece-2.png",
    );
    expect(attempts).toHaveLength(2);
    expect(attempts[1]?.key).toBe(attempts[0]?.key);
  });

  it("says when processing refused an image, and does not report it", async () => {
    const { services } = batchServices({ refuse: true });
    const onProcessed = vi.fn();
    const container = await mount(
      <BulkUpload
        onProcessed={onProcessed}
        purpose="collection-item-artwork"
        services={services}
      />,
    );
    await chooseFiles(container, [imageFile(3, "image/png", "huge.png")]);
    await settle(() => expect(textOf(container)).toContain("1 not accepted"));
    expect(textOf(container)).toContain(
      "The image is too large in width or height.",
    );
    expect(onProcessed).not.toHaveBeenCalled();
  });
  it("offers the picker with the browser's own services when none are given", async () => {
    const container = await mount(
      <BulkUpload purpose="collection-item-artwork" />,
    );
    expect(textOf(container)).toContain("Upload many: collection item artwork");
    expect(container.querySelector("input[multiple]")).not.toBeNull();
  });
});
