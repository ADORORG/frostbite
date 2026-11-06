import { button, click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it } from "vitest";

import { useAction } from "../src/use-action.ts";

const words = (error: unknown) =>
  error instanceof Error ? error.message : "unknown";

function Probe({ work }: { readonly work: () => Promise<void> }) {
  const action = useAction(words);
  return (
    <div>
      <p>
        {action.busy ? "busy" : "idle"}|{action.notice ?? "no notice"}
      </p>
      <button onClick={() => void action.act(work)} type="button">
        run
      </button>
      <button onClick={action.dismissNotice} type="button">
        dismiss
      </button>
    </div>
  );
}

const text = (container: HTMLElement) =>
  container.querySelector("p")?.textContent;

describe("useAction", () => {
  it("is busy while the work runs and idle with no notice when it succeeds", async () => {
    let finish: () => void = () => undefined;
    const container = await mount(
      <Probe
        work={() =>
          new Promise<void>((resolve) => {
            finish = resolve;
          })
        }
      />,
    );
    expect(text(container)).toBe("idle|no notice");
    await click(button(container, "run"));
    expect(text(container)).toBe("busy|no notice");
    finish();
    await settle(() => expect(text(container)).toBe("idle|no notice"));
  });

  it("reports a failure in the feature's words, and clears it when dismissed", async () => {
    const container = await mount(
      <Probe
        work={async () => {
          throw new Error("could not save");
        }}
      />,
    );
    await click(button(container, "run"));
    await settle(() => expect(text(container)).toBe("idle|could not save"));
    await click(button(container, "dismiss"));
    expect(text(container)).toBe("idle|no notice");
  });

  it("clears the last failure as soon as the next action starts", async () => {
    let attempt = 0;
    let finish: () => void = () => undefined;
    const container = await mount(
      <Probe
        work={() => {
          attempt += 1;
          if (attempt === 1) return Promise.reject(new Error("first failed"));
          return new Promise<void>((resolve) => {
            finish = resolve;
          });
        }}
      />,
    );
    await click(button(container, "run"));
    await settle(() => expect(text(container)).toContain("first failed"));
    await click(button(container, "run"));
    expect(text(container)).toBe("busy|no notice");
    finish();
    await settle(() => expect(textOf(container)).toContain("idle|no notice"));
  });

  it("resolves true for finished work and false for failed work", async () => {
    const results: boolean[] = [];
    function Direct() {
      const { act } = useAction(words);
      return (
        <div>
          <button
            onClick={() =>
              void act(async () => undefined).then((done) => results.push(done))
            }
            type="button"
          >
            ok
          </button>
          <button
            onClick={() =>
              void act(async () => {
                throw new Error("x");
              }).then((done) => results.push(done))
            }
            type="button"
          >
            fail
          </button>
        </div>
      );
    }
    const container = await mount(<Direct />);
    await click(button(container, "ok"));
    await click(button(container, "fail"));
    await settle(() => expect(results).toEqual([true, false]));
  });
});
