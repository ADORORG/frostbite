import { describe, expect, it } from "vitest";

import { selectSignInViews, type SignInView } from "../src/sign-in/views.ts";

const view = (kind: string): SignInView => ({
  Component: () => null,
  glyph: "*",
  kind,
  label: kind,
  tagline: kind,
});

describe("which sign-in views the page shows", () => {
  const all = [view("wallet"), view("email"), view("passkey")];

  it("shows the views of the kinds the server offers, in the server's order", () => {
    expect(
      selectSignInViews(["email", "wallet"], all).map(({ kind }) => kind),
    ).toEqual(["email", "wallet"]);
  });

  it("leaves out a kind the server offers that has no view, so nothing is shown that cannot be used", () => {
    expect(
      selectSignInViews(["wallet", "phone"], all).map(({ kind }) => kind),
    ).toEqual(["wallet"]);
  });

  it("never shows a view for a kind the server does not offer", () => {
    expect(selectSignInViews(["wallet"], all)).toHaveLength(1);
    expect(selectSignInViews([], all)).toEqual([]);
  });

  it("takes a new kind with no change to the selection: only a view is added", () => {
    const withPhone = [...all, view("phone")];
    expect(
      selectSignInViews(["wallet", "phone"], withPhone).map(({ kind }) => kind),
    ).toEqual(["wallet", "phone"]);
  });
});
