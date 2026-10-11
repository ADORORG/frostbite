import type {
  CollectionImportResponse,
  CollectionImportRow,
} from "@ador/shared/collections";
import type { IdempotencyKey } from "@ador/shared/http";
import { useRef, useState } from "react";

import type { CollectionsClientServices } from "../../client/services.ts";
import {
  formatOf,
  importFileMaxBytes,
  parseImport,
  type ParsedImport,
} from "../../client/import-parse.ts";
import { useAction } from "./use-action.ts";

// Where an import stands. Choosing a file reads it and, when every row reads cleanly, asks the server to
// check the images and the supply (nothing is written); adding is a separate, deliberate step.
export type ItemImportState =
  | { readonly step: "choose" }
  | { readonly message: string; readonly step: "unreadable" }
  | {
      readonly fileName: string;
      readonly parsed: ParsedImport;
      readonly step: "read";
    }
  | {
      readonly fileName: string;
      readonly parsed: ParsedImport;
      readonly report: CollectionImportResponse;
      readonly rows: readonly CollectionImportRow[];
      readonly step: "checked";
    }
  | { readonly added: number; readonly step: "added" };

export interface ItemImport {
  readonly add: () => Promise<void>;
  readonly busy: boolean;
  readonly choose: (file: File) => Promise<void>;
  readonly dismissNotice: ReturnType<typeof useAction>["dismissNotice"];
  readonly notice: ReturnType<typeof useAction>["notice"];
  readonly reset: () => void;
  readonly state: ItemImportState;
}

const unreadable = (message: string): ItemImportState => ({
  message,
  step: "unreadable",
});

// Reads a list of items from a file and adds them to the collection, all or none. One key is kept for
// the whole attempt to add, so pressing the button again after a lost response cannot add them twice.
export function useItemImport(
  services: CollectionsClientServices,
  collectionId: string,
  onAdded: () => Promise<void>,
): ItemImport {
  const [state, setState] = useState<ItemImportState>({ step: "choose" });
  const { act, busy, dismissNotice, notice } = useAction();
  const addKey = useRef<IdempotencyKey | null>(null);

  async function check(
    fileName: string,
    parsed: ParsedImport,
    rows: readonly CollectionImportRow[],
  ) {
    let report: CollectionImportResponse | null = null;
    const done = await act(async () => {
      report = await services.api.importItems(
        { collectionId, dryRun: true, rows: [...rows] },
        { idempotencyKey: services.createIdempotencyKey() },
      );
    });
    if (done && report !== null)
      setState({ fileName, parsed, report, rows, step: "checked" });
  }

  return {
    add: async () => {
      if (state.step !== "checked") return;
      const { rows } = state;
      addKey.current ??= services.createIdempotencyKey();
      const idempotencyKey = addKey.current;
      let report: CollectionImportResponse | null = null;
      const done = await act(async () => {
        report = await services.api.importItems(
          { collectionId, dryRun: false, rows: [...rows] },
          { idempotencyKey },
        );
        if (report.imported) await onAdded();
      });
      if (!done || report === null) return;
      const result: CollectionImportResponse = report;
      addKey.current = null;
      setState(
        result.imported
          ? { added: result.rows.length, step: "added" }
          : { ...state, report: result },
      );
    },
    busy,
    choose: async (file) => {
      addKey.current = null;
      if (file.size > importFileMaxBytes)
        return setState(
          unreadable(
            "This file is too large. A list of items is far smaller; check that it is the right file.",
          ),
        );
      const text = await file.text().catch(() => null);
      if (text === null)
        return setState(unreadable("The file could not be read."));
      const parsed = parseImport(text, formatOf(file.name));
      setState({ fileName: file.name, parsed, step: "read" });
      if (parsed.kind !== "rows") return;
      const rows = parsed.rows.flatMap((row) => (row.ok ? [row.row] : []));
      if (rows.length === parsed.rows.length)
        await check(file.name, parsed, rows);
    },
    dismissNotice,
    notice,
    reset: () => {
      addKey.current = null;
      setState({ step: "choose" });
    },
    state,
  };
}
