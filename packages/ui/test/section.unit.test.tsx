// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";

import { ArcadeDialog } from "../src/components/arcade-dialog.tsx";
import {
  SectionBlock,
  Tile,
  TileGrid,
} from "../src/components/section-block.tsx";
import { show } from "./support/render.tsx";

afterEach(() => {
  document.body.replaceChildren();
});
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

it("sets a part of a page apart by its heading, with what it is for and what can be done to it", async () => {
  const box = await show(
    <SectionBlock
      actions={<button type="button">Do</button>}
      description="What this is for."
      title="Templates"
    >
      <p>Body</p>
    </SectionBlock>,
  );
  const section = box.querySelector("section");
  expect(section?.getAttribute("aria-label")).toBe("Templates");
  expect(box.querySelector(".block__title")?.textContent).toBe("Templates");
  expect(box.querySelector(".block__description")?.textContent).toBe(
    "What this is for.",
  );
  expect(box.querySelector(".block__actions button")?.textContent).toBe("Do");
  expect(box.querySelector(".block__body")?.textContent).toBe("Body");
});

it("draws no description or actions it was not given", async () => {
  const box = await show(<SectionBlock title="Log">Body</SectionBlock>);
  expect(box.querySelector(".block__description")).toBeNull();
  expect(box.querySelector(".block__actions")).toBeNull();
});

it("lays out tiles, each with its title, badge, body and footer, and leaves out the parts it has none of", async () => {
  const box = await show(
    <TileGrid>
      <Tile
        badge={<span>Done</span>}
        footer={<button type="button">Go</button>}
        title="One"
      >
        Words
      </Tile>
      <Tile title="Two" />
    </TileGrid>,
  );
  const tiles = [...box.querySelectorAll(".tile")];
  expect(tiles).toHaveLength(2);
  expect(tiles[0]?.querySelector(".tile__title")?.textContent).toBe("One");
  expect(tiles[0]?.querySelector(".tile__head span")?.textContent).toBe("Done");
  expect(tiles[0]?.querySelector(".tile__body")?.textContent).toBe("Words");
  expect(tiles[0]?.querySelector(".tile__footer button")?.textContent).toBe(
    "Go",
  );
  expect(tiles[1]?.querySelector(".tile__body")).toBeNull();
  expect(tiles[1]?.querySelector(".tile__footer")).toBeNull();
});

it("keeps a dialog's buttons in view under its body, and widens it for something to read", async () => {
  const plain = await show(
    <ArcadeDialog onClose={() => undefined} open title="Choose">
      Short
    </ArcadeDialog>,
  );
  expect(plain.querySelector("dialog")?.className).toBe("arcade-modal");
  expect(plain.querySelector(".arcade-modal__footer")).toBeNull();
  const wide = await show(
    <ArcadeDialog
      footer={<button type="button">Sign</button>}
      onClose={() => undefined}
      open
      title="Review"
      wide
    >
      Long
    </ArcadeDialog>,
  );
  expect(wide.querySelector("dialog")?.className).toBe(
    "arcade-modal arcade-modal--wide",
  );
  expect(wide.querySelector(".arcade-modal__footer button")?.textContent).toBe(
    "Sign",
  );
});
