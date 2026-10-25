import { describe, expect, it, vi } from "vitest";

import {
  createRoleDirectory,
  type DirectoryEntry,
} from "../src/application/role-directory.ts";

const entry: DirectoryEntry = { label: "ada", roles: [], userId: "u1" };
function directory() {
  const repository = {
    find: vi.fn(async () => [entry]),
    holders: vi.fn(async () => [entry]),
  };
  return { directory: createRoleDirectory({ repository }), repository };
}

describe("the role directory", () => {
  it("lists the holders as the repository has them", async () => {
    const { directory: roles, repository } = directory();
    expect(await roles.holders()).toEqual([entry]);
    expect(repository.holders).toHaveBeenCalledOnce();
  });

  it("finds by the trimmed text, asking for at most ten", async () => {
    const { directory: roles, repository } = directory();
    expect(await roles.find("  ada@example.com  ")).toEqual([entry]);
    expect(repository.find).toHaveBeenCalledWith("ada@example.com", 10);
  });

  it("finds nobody for an empty query or one that is too long, without asking", async () => {
    const { directory: roles, repository } = directory();
    expect(await roles.find("")).toEqual([]);
    expect(await roles.find("   ")).toEqual([]);
    expect(await roles.find("x".repeat(201))).toEqual([]);
    expect(repository.find).not.toHaveBeenCalled();
    expect(await roles.find("x".repeat(200))).toEqual([entry]);
  });
});
