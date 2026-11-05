import {
  button,
  click,
  fieldByLabel,
  mount,
  settle,
  textOf,
  typeInto,
} from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { TemplatesPanel } from "../src/ui/templates-panel.tsx";
import { creating, defining, fakeApi, step } from "./support/fake-api.ts";
import { byName } from "./support/find.ts";
import { enterWallet, panel } from "./support/panel.tsx";
import { sheetTitle, slowStart } from "./support/slow-start.ts";

describe("an action pressed on a game's page", () => {
  it("shows pause being prepared on the pause button only", async () => {
    const slow = slowStart();
    const container = await panel(fakeApi({ start: slow.start }));
    await enterWallet(container);
    await click(byName(container, "Pause claims"));
    expect(sheetTitle(container)).toBe("Pause claims");
    expect(byName(container, "Pause claims")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(byName(container, "Resume claims")?.hasAttribute("aria-busy")).toBe(
      false,
    );
    expect(byName(container, "Resume claims")?.disabled).toBe(true);
    slow.answer({ resumed: false, status: "started", step: step() });
    await settle(() =>
      expect(
        container.querySelector('[data-testid="step-review"]'),
      ).not.toBeNull(),
    );
  });

  it("shows resume being prepared on the resume button only", async () => {
    const slow = slowStart();
    const container = await panel(fakeApi({ start: slow.start }));
    await enterWallet(container);
    await click(byName(container, "Resume claims"));
    expect(sheetTitle(container)).toBe("Resume claims");
    expect(byName(container, "Resume claims")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(byName(container, "Pause claims")?.hasAttribute("aria-busy")).toBe(
      false,
    );
  });

  it("shows a milestone being defined on its own row only", async () => {
    const slow = slowStart();
    const container = await panel(fakeApi({ start: slow.start }));
    await enterWallet(container);
    await click(byName(container, "Define Streak"));
    expect(sheetTitle(container)).toBe("Define milestone streak");
    expect(byName(container, "Define Streak")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(byName(container, "Define Streak")?.textContent).toBe("Preparing…");
    expect(
      byName(container, "Define First win")?.hasAttribute("aria-busy"),
    ).toBe(false);
    slow.answer({ resumed: false, status: "started", step: defining() });
    await settle(() =>
      expect(
        container.querySelector('[data-testid="step-review"]'),
      ).not.toBeNull(),
    );
  });

  it("shows the contract being created on its button", async () => {
    const slow = slowStart();
    const container = await panel(
      fakeApi({
        list: vi.fn(async () => ({
          contract: null,
          drawingCeiling: 8192,
          steps: [],
          templatesReady: true,
        })),
        start: slow.start,
      }),
    );
    await settle(() =>
      expect(button(container, "Create the contract")).not.toBeNull(),
    );
    await enterWallet(container);
    await click(button(container, "Create the contract"));
    expect(sheetTitle(container)).toBe("Create the game's contract");
    expect(
      container.querySelector("button[aria-busy='true']")?.textContent,
    ).toBe("Preparing…");
    slow.answer({ resumed: false, status: "started", step: creating() });
    await settle(() =>
      expect(
        container.querySelector('[data-testid="step-review"]'),
      ).not.toBeNull(),
    );
  });
});

describe("the line that says who signs", () => {
  it("asks for the address while there is none, and keeps asking while it is typed, closing only when told", async () => {
    const container = await panel();
    expect(textOf(container)).toContain("no wallet address yet");
    expect(button(container, "Change")).toBeNull();
    await typeInto(fieldByLabel(container, "Wallet address"), "s");
    // One character makes an address, and the field must still be there to finish typing in.
    expect(fieldByLabel(container, "Wallet address")).not.toBeNull();
    await typeInto(
      fieldByLabel(container, "Wallet address"),
      "sim:one:a1b2c3fe",
    );
    expect(
      container.querySelector(".signer-bar code")?.getAttribute("title"),
    ).toBe("sim:one:a1b2c3fe");
    expect(container.querySelector(".signer-bar code")?.textContent).toBe(
      "sim:on…c3fe",
    );
    await click(button(container, "Done"));
    expect(
      container.querySelector(
        'input[aria-label="Wallet address"], label input',
      ),
    ).toBeNull();
    await click(button(container, "Change"));
    expect(fieldByLabel(container, "Wallet address")).not.toBeNull();
  });

  it("asks for the auth token's output only on a page whose steps spend it", async () => {
    const withContract = await panel();
    expect(fieldByLabel(withContract, "Auth token output")).not.toBeNull();
    const without = await mount(<TemplatesPanel api={fakeApi()} />);
    await settle(() => expect(textOf(without)).toContain("Templates"));
    expect(textOf(without)).not.toContain("Auth token output");
  });

  it("starts nothing, and says what to do, while no address is entered", async () => {
    const api = fakeApi();
    const container = await panel(api);
    expect(textOf(container)).toContain(
      "Enter your wallet address to start a step.",
    );
    expect(byName(container, "Pause claims")?.disabled).toBe(true);
    await click(byName(container, "Pause claims"));
    expect(api.start).not.toHaveBeenCalled();
  });
});
