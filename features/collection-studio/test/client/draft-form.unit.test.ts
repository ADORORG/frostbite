import { collectionLimits } from "@ador/shared/collections";
import { describe, expect, it } from "vitest";

import {
  formFromDraft,
  newDraftForm,
  parseDraftForm,
  type DraftFormValues,
} from "../../src/client/draft-form.ts";
import { detail } from "../support/detail.ts";
import { signet } from "../support/stubs.ts";

const valid: DraftFormValues = {
  bannerAssetId: null,
  coverAssetId: null,
  description: "A small collection",
  name: "First light",
  plannedSupply: "5",
  provenance: "Drawn by hand",
  targetChain: signet,
};

function errorsOf(overrides: Partial<DraftFormValues>) {
  const result = parseDraftForm({ ...valid, ...overrides });
  if (result.ok) throw new Error("expected the form to be refused");
  return result.errors;
}

describe("draft form", () => {
  it("turns what was typed into a draft, trimming text and reading the supply as a number", () => {
    const result = parseDraftForm({
      ...valid,
      name: "  Padded  ",
      plannedSupply: " 12 ",
    });
    if (!result.ok) throw new Error("expected a valid draft");
    expect(result.draft).toMatchObject({ name: "Padded", plannedSupply: 12 });
  });

  it("round-trips a draft through the form without changing it", () => {
    const parsed = parseDraftForm(valid);
    if (!parsed.ok) throw new Error("expected a valid draft");
    expect(parseDraftForm(formFromDraft(parsed.draft))).toEqual(parsed);
    expect(formFromDraft(parsed.draft).plannedSupply).toBe("5");
  });

  it("ignores the extra fields of a stored record, so it can be edited and saved again", () => {
    const stored = detail({
      description: "About",
      plannedSupply: 7,
    }).collection;
    const form = formFromDraft(stored);
    expect(Object.keys(form).sort()).toEqual([
      "bannerAssetId",
      "coverAssetId",
      "description",
      "name",
      "plannedSupply",
      "provenance",
      "targetChain",
    ]);
    const parsed = parseDraftForm(form);
    expect(parsed.ok && parsed.draft.plannedSupply).toBe(7);
  });

  it("starts a new form empty, on the chosen chain", () => {
    expect(newDraftForm(signet)).toMatchObject({
      name: "",
      plannedSupply: "",
      targetChain: signet,
    });
    expect(parseDraftForm(newDraftForm(signet)).ok).toBe(false);
  });

  it.each([
    ["a blank name", { name: "   " }, "name"],
    [
      "a name over the limit",
      { name: "x".repeat(collectionLimits.name + 1) },
      "name",
    ],
    ["no supply", { plannedSupply: "" }, "plannedSupply"],
    [
      "a supply that is not a number",
      { plannedSupply: "many" },
      "plannedSupply",
    ],
    ["a fractional supply", { plannedSupply: "1.5" }, "plannedSupply"],
    ["a zero supply", { plannedSupply: "0" }, "plannedSupply"],
    [
      "a supply over the limit",
      { plannedSupply: String(collectionLimits.plannedSupply + 1) },
      "plannedSupply",
    ],
    [
      "a long description",
      { description: "x".repeat(collectionLimits.description + 1) },
      "description",
    ],
    [
      "a long provenance",
      { provenance: "x".repeat(collectionLimits.provenance + 1) },
      "provenance",
    ],
    ["a chain that is not valid", { targetChain: "bitcoin" }, "targetChain"],
  ] as const)(
    "refuses %s, in words, on the right field",
    (_name, change, field) => {
      const errors = errorsOf(change);
      expect(Object.keys(errors)).toEqual([field]);
      expect(errors[field]).toMatch(/\w+/u);
    },
  );

  it("accepts the limits exactly", () => {
    const result = parseDraftForm({
      ...valid,
      name: "x".repeat(collectionLimits.name),
      plannedSupply: String(collectionLimits.plannedSupply),
    });
    expect(result.ok).toBe(true);
  });

  it("reports every field that is wrong at once", () => {
    expect(
      Object.keys(errorsOf({ name: "", plannedSupply: "0" })).sort(),
    ).toEqual(["name", "plannedSupply"]);
  });
});
