import { describe, expect, it } from "vitest";

import { appNameFrom } from "../src/stack-app-name.ts";

describe("the name the stack calls the platform", () => {
  it("is the settings file's, so the stack shows the product as it will be", () => {
    expect(appNameFrom("NEXT_PUBLIC_APP_NAME=Adorbitals", {})).toBe(
      "Adorbitals",
    );
    expect(appNameFrom("NEXT_PUBLIC_APP_NAME=  Adorbitals  ", {})).toBe(
      "Adorbitals",
    );
  });
  it("is the shell's when both are set", () => {
    expect(
      appNameFrom("NEXT_PUBLIC_APP_NAME=Adorbitals", {
        NEXT_PUBLIC_APP_NAME: "Mine",
      }),
    ).toBe("Mine");
  });
  it("is nothing when no one named it, so the fixture name stays", () => {
    expect(appNameFrom(null, {})).toBeNull();
    expect(appNameFrom("OTHER=1", {})).toBeNull();
    expect(
      appNameFrom("NEXT_PUBLIC_APP_NAME=", { NEXT_PUBLIC_APP_NAME: " " }),
    ).toBeNull();
  });
});
