import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  gameAdminSteps,
  gameContracts,
  publishedTemplates,
} from "../src/index.ts";

const names = (items: readonly { readonly name: string }[]) =>
  items.map(({ name }) => name);

describe("the administration log", () => {
  it("is about one game or, for a template, none, and acts on a contract only for the steps on one", () => {
    const config = getTableConfig(gameAdminSteps);
    expect(names(config.checks)).toEqual(
      expect.arrayContaining([
        "game_admin_steps_operation_known",
        "game_admin_steps_milestone_coherent",
        "game_admin_steps_subject_coherent",
        "game_admin_steps_contract_coherent",
      ]),
    );
    const column = (name: string) =>
      config.columns.find((candidate) => candidate.name === name);
    expect(column("game_id")?.notNull).toBe(false);
    expect(column("template_ref")?.notNull).toBe(false);
    expect(column("contract_id")?.notNull).toBe(false);
    expect(column("contract_family")?.notNull).toBe(false);
    expect(column("created_contracts")?.notNull).toBe(false);
  });

  it("allows one step in progress per game, template, operation and milestone, and is never deleted by its staff's account", () => {
    const config = getTableConfig(gameAdminSteps);
    const one = config.indexes.find(
      ({ config: index }) =>
        index.name === "game_admin_steps_one_in_progress_idx",
    );
    expect(one?.config.unique).toBe(true);
    expect(one?.config.columns).toHaveLength(4);
    expect(config.foreignKeys.map((key) => key.onDelete)).toEqual([
      "set null",
      "set null",
    ]);
  });
});

describe("the record of published templates", () => {
  it("holds one address per template and chain, and never two templates at one address", () => {
    const config = getTableConfig(publishedTemplates);
    expect(config.primaryKeys[0]?.columns.map(({ name }) => name)).toEqual([
      "chain",
      "template_ref",
    ]);
    expect(
      config.indexes.map(({ config: index }) => [index.name, index.unique]),
    ).toEqual([["published_templates_address_idx", true]]);
    expect(names(config.checks)).toEqual([
      "published_templates_code_hash_shape",
    ]);
  });

  it("keeps the step that published it", () => {
    const config = getTableConfig(publishedTemplates);
    expect(
      config.foreignKeys.map((key) => [
        getTableName(key.reference().foreignTable),
        key.onDelete,
      ]),
    ).toEqual([[getTableName(gameAdminSteps), "restrict"]]);
  });
});

describe("the record of games' contracts", () => {
  it("holds one contract per game and chain, never two games at one address, and a drawing size above zero", () => {
    const config = getTableConfig(gameContracts);
    expect(config.primaryKeys[0]?.columns.map(({ name }) => name)).toEqual([
      "game_id",
      "chain",
    ]);
    expect(
      config.indexes.map(({ config: index }) => [index.name, index.unique]),
    ).toEqual([["game_contracts_address_idx", true]]);
    expect(names(config.checks)).toEqual([
      "game_contracts_max_drawing_bytes_positive",
    ]);
  });

  it("keeps the step that created it", () => {
    const config = getTableConfig(gameContracts);
    expect(
      config.foreignKeys.map((key) => [
        getTableName(key.reference().foreignTable),
        key.onDelete,
      ]),
    ).toEqual([[getTableName(gameAdminSteps), "restrict"]]);
  });
});
