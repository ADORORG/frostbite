// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import {
  button,
  buttonMatching,
  chooseOption,
  click,
  fieldByLabel,
  installReactTestEnvironment,
  mount,
  settle,
  textOf,
  typeInto,
  unmountAll,
} from "../src/dom.tsx";

installReactTestEnvironment();

describe("react test helpers", () => {
  it("mounts a tree and removes it again", async () => {
    const container = await mount(<p>Hello</p>);
    expect(document.body.contains(container)).toBe(true);
    expect(textOf(container)).toBe("Hello");
    await unmountAll();
    expect(document.body.contains(container)).toBe(false);
  });

  it("finds a button by its exact label and clicks it", async () => {
    const onClick = vi.fn();
    const container = await mount(
      <>
        <button onClick={onClick} type="button">
          Save
        </button>
        <button type="button">Save draft</button>
      </>,
    );
    expect(button(container, "Missing")).toBeNull();
    expect(buttonMatching(container, /^Save d/u)?.textContent).toBe(
      "Save draft",
    );
    expect(buttonMatching(container, /nothing/u)).toBeNull();
    await click(button(container, "Save"));
    expect(onClick).toHaveBeenCalledOnce();
    expect(() => click(null)).toThrow("element to click is missing");
  });

  it("waits for something that happens by itself, and fails when it never does", async () => {
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 20);
    await settle(() => expect(ready).toBe(true));
    await expect(settle(() => expect(ready).toBe(false), 50)).rejects.toThrow();
  });

  it("chooses a select option and types into inputs and textareas", async () => {
    const seen: string[] = [];
    const container = await mount(
      <>
        <label>
          Kind
          <select onChange={(event) => seen.push(event.target.value)}>
            <option value="a">A</option>
            <option value="b">B</option>
          </select>
        </label>
        <label>
          Name
          <input onChange={(event) => seen.push(event.target.value)} />
        </label>
        <label>
          About
          <textarea onChange={(event) => seen.push(event.target.value)} />
        </label>
      </>,
    );
    await chooseOption(container, "b");
    await typeInto(fieldByLabel(container, "Name"), "First");
    await typeInto(fieldByLabel(container, "About"), "More");
    expect(seen).toEqual(["b", "First", "More"]);
    expect(fieldByLabel(container, "Kind").tagName).toBe("SELECT");
  });

  it("refuses a missing select or a label that no field has", async () => {
    const container = await mount(<p>None</p>);
    await expect(chooseOption(container, "x")).rejects.toThrow(
      "select is missing",
    );
    expect(() => fieldByLabel(container, "Name")).toThrow(
      'no field labelled "Name"',
    );
  });
});
