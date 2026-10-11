// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { ArcadeEmptyState } from "../src/components/arcade-empty-state.tsx";
import { ArcadeFilterTabs } from "../src/components/arcade-filter-tabs.tsx";

const options = [
  { count: 3, label: "All", value: "all" },
  { count: 2, label: "Drafts", value: "draft" },
] as const;

it("shows every filter with its count and marks only the chosen one as pressed", () => {
  const html = renderToStaticMarkup(
    <ArcadeFilterTabs
      label="Show"
      onChange={() => undefined}
      options={options}
      value="draft"
    />,
  );
  const container = document.createElement("div");
  container.innerHTML = html;
  const buttons = [...container.querySelectorAll("button")];
  expect(buttons.map((button) => button.textContent)).toEqual([
    "All3",
    "Drafts2",
  ]);
  expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual([
    "false",
    "true",
  ]);
  expect(
    container.querySelector('[role="group"]')?.getAttribute("aria-label"),
  ).toBe("Show");
});

it("reports the filter that was chosen", async () => {
  const onChange = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  await act(() =>
    root.render(
      <ArcadeFilterTabs
        label="Show"
        onChange={onChange}
        options={options}
        value="all"
      />,
    ),
  );
  const [, drafts] = container.querySelectorAll("button");
  await act(() => {
    drafts?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onChange).toHaveBeenCalledExactlyOnceWith("draft");
  await act(() => root.unmount());
  container.remove();
});

it("says what is missing and offers the one thing to do, when there is one", () => {
  const withAction = renderToStaticMarkup(
    <ArcadeEmptyState action={<a href="/new">Start</a>} title="Nothing yet">
      Collections you start appear here.
    </ArcadeEmptyState>,
  );
  expect(withAction).toContain("<h3>Nothing yet</h3>");
  expect(withAction).toContain("Collections you start appear here.");
  expect(withAction).toContain('<a href="/new">Start</a>');
  const withoutAction = renderToStaticMarkup(
    <ArcadeEmptyState title="Nothing yet">Wait.</ArcadeEmptyState>,
  );
  expect(withoutAction).not.toContain("arcade-actions");
});
