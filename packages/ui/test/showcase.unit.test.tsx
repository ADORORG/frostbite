// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";

import { Showcase } from "../src/patterns/showcase.tsx";
import { show } from "./support/render.tsx";

afterEach(() => {
  document.body.replaceChildren();
});

it("heads a page with the name as its one heading, the cover beside it, the facts as chips and the words under them", async () => {
  const box = await show(
    <Showcase
      backdrop={<img alt="Banner" src="/b.png" />}
      cover={<img alt="Cover" src="/c.png" />}
      facts={<span>Bitcoin signet</span>}
      status={<p className="status-lamp">Approved</p>}
      title="First light"
    >
      <p>Hand-drawn lights.</p>
    </Showcase>,
  );
  expect(box.querySelectorAll("h1")).toHaveLength(1);
  expect(box.querySelector("h1")?.textContent).toBe("First light");
  expect(box.querySelector(".showcase__cover img")?.getAttribute("alt")).toBe(
    "Cover",
  );
  expect(
    box.querySelector(".showcase__backdrop img")?.getAttribute("alt"),
  ).toBe("Banner");
  expect(box.querySelector(".showcase__facts")?.textContent).toBe(
    "Bitcoin signet",
  );
  expect(box.querySelector(".showcase__text")?.textContent).toContain(
    "Approved",
  );
  expect(box.querySelector(".showcase__text")?.textContent).toContain(
    "Hand-drawn lights.",
  );
});

it("draws no backdrop and no facts it was not given", async () => {
  const box = await show(<Showcase cover={null} title="Bare" />);
  expect(box.querySelector(".showcase__backdrop")).toBeNull();
  expect(box.querySelector(".showcase__facts")).toBeNull();
});
