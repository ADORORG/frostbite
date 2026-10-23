// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";

import { ActionProgress, Spinner } from "../src/components/action-progress.tsx";
import { KeyValueList } from "../src/components/key-value-list.tsx";
import { StatusDot } from "../src/primitives/status-dot.tsx";
import { show } from "./support/render.tsx";

afterEach(() => {
  document.body.replaceChildren();
});

it("lists the facts it was given and leaves no row for one it has nothing to say about", async () => {
  const box = await show(
    <KeyValueList
      items={[
        { label: "Network", value: "Bitcoin testnet4" },
        { label: "Contract", value: undefined },
        { label: "Template", value: null },
        { label: "Address", mono: true, value: "tb1qabc" },
        { label: "Zero", value: 0 },
      ]}
      label="Step"
    />,
  );
  const rows = [...box.querySelectorAll(".kv__row")].map((row) => [
    row.querySelector("dt")?.textContent,
    row.querySelector("dd")?.textContent,
    row.querySelector("dd")?.getAttribute("data-mono"),
  ]);
  expect(rows).toEqual([
    ["Network", "Bitcoin testnet4", null],
    ["Address", "tb1qabc", "true"],
    ["Zero", "0", null],
  ]);
  expect(box.querySelector("dl")?.getAttribute("aria-label")).toBe("Step");
});

it("draws nothing at all when there is nothing to list", async () => {
  const box = await show(
    <KeyValueList items={[{ label: "A", value: undefined }]} />,
  );
  expect(box.innerHTML).toBe("");
});

it("says what is being done, as a status that is read out, with the ring turning only while it is", async () => {
  const working = await show(
    <ActionProgress detail="This can take a few seconds." title="Building">
      <p>extra</p>
    </ActionProgress>,
  );
  const status = working.querySelector('[role="status"]');
  expect(status?.getAttribute("aria-live")).toBe("polite");
  expect(status?.textContent).toContain("Building");
  expect(status?.textContent).toContain("This can take a few seconds.");
  expect(status?.textContent).toContain("extra");
  expect(working.querySelector(".spinner")).not.toBeNull();
  const done = await show(<ActionProgress title="Done" working={false} />);
  expect(done.querySelector(".spinner")).toBeNull();
});

it("tells each stage's state in words as well as marks, so colour is never the only signal", async () => {
  const box = await show(
    <ActionProgress
      steps={[
        { label: "Built", state: "done" },
        { detail: "Waiting for your wallet", label: "Signed", state: "active" },
        { label: "Sent", state: "pending" },
        { label: "Confirmed", state: "failed" },
      ]}
      title="The step"
    />,
  );
  const items = [...box.querySelectorAll(".progress-steps li")];
  expect(items.map((item) => item.getAttribute("data-state"))).toEqual([
    "done",
    "active",
    "pending",
    "failed",
  ]);
  expect(items.map((item) => item.textContent)).toEqual([
    "✓Built (done)",
    "2Signed (in progress)Waiting for your wallet",
    "3Sent (not yet)",
    "✕Confirmed (failed)",
  ]);
});

it("draws a ring and a light that carry no meaning of their own", async () => {
  const box = await show(
    <>
      <Spinner />
      <StatusDot tone="ready" />
    </>,
  );
  expect(box.querySelector(".spinner")?.getAttribute("aria-hidden")).toBe(
    "true",
  );
  const dot = box.querySelector(".status-dot");
  expect(dot?.className).toBe("status-dot status-dot--ready");
  expect(dot?.getAttribute("aria-hidden")).toBe("true");
});
