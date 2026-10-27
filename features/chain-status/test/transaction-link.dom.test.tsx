import { mount, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { explorerLink } from "../src/domain/explorer-link.ts";
import {
  ExplorerBoundary,
  TransactionLink,
  TransactionList,
} from "../src/ui/transaction-entry.ts";

const template = "https://explorer.test/tx/{id}";
const list = (
  <TransactionList transactions={[{ id: "ab", label: "Commit transaction" }]} />
);
const anchors = (container: HTMLElement) => [
  ...container.querySelectorAll("a"),
];

describe("the link to a transaction", () => {
  it("puts the id where the address says, encoded, and links nothing without a place for it", () => {
    expect(explorerLink(template, "ab")).toBe("https://explorer.test/tx/ab");
    expect(explorerLink(template, "a b/c")).toBe(
      "https://explorer.test/tx/a%20b%2Fc",
    );
    expect(explorerLink("https://explorer.test/", "ab")).toBeNull();
  });
});

describe("a transaction shown to a person", () => {
  it("links the id to the explorer in a new tab that cannot reach back", async () => {
    const container = await mount(
      <ExplorerBoundary txUrl={template}>{list}</ExplorerBoundary>,
    );
    const [link] = anchors(container);
    expect(link?.href).toBe("https://explorer.test/tx/ab");
    expect(link?.textContent).toBe("ab");
    expect(link?.target).toBe("_blank");
    expect(link?.rel).toContain("noopener");
    expect(textOf(container)).toContain("Commit transaction");
    expect(
      container.querySelector('[aria-label="Transactions on the network"]'),
    ).not.toBeNull();
  });

  it("shows the id as text where no explorer is given, or the address cannot name a transaction", async () => {
    const bare = await mount(list);
    expect(anchors(bare)).toEqual([]);
    expect(textOf(bare)).toContain("ab");
    const front = await mount(
      <ExplorerBoundary txUrl="https://explorer.test/">
        <TransactionLink id="cd" />
      </ExplorerBoundary>,
    );
    expect(anchors(front)).toEqual([]);
    expect(textOf(front)).toBe("cd");
  });
});
