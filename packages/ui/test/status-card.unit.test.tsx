// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";

import { ArcadeStatusCard } from "../src/components/arcade-status-card.tsx";
import { show } from "./support/render.tsx";

afterEach(() => {
  document.body.replaceChildren();
});

it("says its state in words under a tone, keeps reading apart from the one action, and leaves out what it was not given", async () => {
  const full = await show(
    <ArcadeStatusCard
      action={<button type="button">Claim</button>}
      status={{ label: "Reached", tone: "done" }}
      title="First win"
    >
      <p>How it is earned.</p>
    </ArcadeStatusCard>,
  );
  expect(full.querySelector(".status-card")?.getAttribute("data-tone")).toBe(
    "done",
  );
  expect(full.querySelector(".status-card__title")?.textContent).toBe(
    "First win",
  );
  expect(full.querySelector(".status-card__state")?.textContent).toBe(
    "Reached",
  );
  expect(full.querySelector(".status-card__body")?.textContent).toBe(
    "How it is earned.",
  );
  expect(full.querySelector(".status-card__action button")?.textContent).toBe(
    "Claim",
  );
  const bare = await show(<ArcadeStatusCard title="Plain" />);
  expect(bare.querySelector(".status-card__state")).toBeNull();
  expect(bare.querySelector(".status-card__body")).toBeNull();
  expect(bare.querySelector(".status-card__action")).toBeNull();
  expect(bare.querySelector(".status-card")?.hasAttribute("data-tone")).toBe(
    false,
  );
});
