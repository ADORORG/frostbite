import { collectionLimits } from "@frostbite/shared/collections";
import {
  ArcadeActionButton,
  ArcadeFileDrop,
  StatusLamp,
} from "@repo/ui/arcade";

import { importTemplate } from "../../client/import-template.ts";
import {
  importFormats,
  type ImportFormat,
  type ParsedRow,
} from "../../client/import-parse.ts";
import type { ItemImport } from "../hooks/use-item-import.ts";
import { ImportReport } from "./import-report.tsx";

const accept = ".csv,.json,text/csv,application/json";

function TemplateLinks() {
  return (
    <p className="arcade-actions">
      {importFormats.map((format: ImportFormat) => {
        const template = importTemplate(format);
        return (
          <a
            download={template.fileName}
            href={`data:${template.mimeType};charset=utf-8,${encodeURIComponent(template.text)}`}
            key={format}
          >
            {`Download a ${format.toUpperCase()} template`}
          </a>
        );
      })}
    </p>
  );
}

const countWord = (count: number) =>
  count === 1 ? "1 item" : `${count} items`;

// Add a list of items from a file instead of one at a time. The file is read here, every row is checked
// (by this page for what the file says, and by the server for the images and the supply) and nothing is
// added until the creator says so, and then all of it or none.
export function ImportItems({
  importer,
  plannedSupply,
}: {
  readonly importer: ItemImport;
  readonly plannedSupply: number;
}) {
  const { state } = importer;
  const rows: readonly ParsedRow[] =
    state.step === "read" || state.step === "checked"
      ? state.parsed.kind === "rows"
        ? state.parsed.rows
        : []
      : [];
  const reports = state.step === "checked" ? state.report.rows : [];
  const problemRows = rows.filter(
    (row) =>
      !row.ok ||
      (reports.find(({ row: number }) => number === row.number)?.problems
        .length ?? 0) > 0,
  ).length;
  const ready =
    state.step === "checked" && rows.length > 0 && problemRows === 0;
  return (
    <div className="arcade-form">
      <p>
        {`List your items in a CSV or JSON file: a name, a description, the file name of the image, and any traits. Upload the images first; they are matched by file name. A file holds up to ${collectionLimits.importRows} items, and it is added all together or not at all.`}
      </p>
      <TemplateLinks />
      <ArcadeFileDrop
        accept={accept}
        disabled={importer.busy}
        hint="A .csv or .json file."
        label="Choose a file of items"
        onFile={(file) => void importer.choose(file)}
      />
      {importer.notice === null ? null : (
        <StatusLamp label={importer.notice.message} tone="unavailable" />
      )}
      {state.step === "unreadable" ? <p role="alert">{state.message}</p> : null}
      {(state.step === "read" || state.step === "checked") &&
      state.parsed.kind === "file-problem" ? (
        <p role="alert">{state.parsed.message}</p>
      ) : null}
      {rows.length > 0 ? (
        <>
          <p role="status">
            {problemRows === 0
              ? state.step === "checked"
                ? `${countWord(rows.length)} found, all ready to add.`
                : `${countWord(rows.length)} found.`
              : `${countWord(rows.length)} found, ${problemRows} to fix. Nothing is added until every item is ready.`}
          </p>
          <ImportReport
            plannedSupply={plannedSupply}
            reports={reports}
            rows={rows}
          />
        </>
      ) : null}
      {state.step === "added" ? (
        <StatusLamp
          label={`Added ${countWord(state.added)} to the collection.`}
          tone="ready"
        />
      ) : null}
      <div className="arcade-actions">
        {ready ? (
          <ArcadeActionButton
            disabled={importer.busy}
            onClick={() => void importer.add()}
            tone="mint"
          >
            {`Add ${countWord(rows.length)}`}
          </ArcadeActionButton>
        ) : null}
        {state.step === "choose" ? null : (
          <ArcadeActionButton
            disabled={importer.busy}
            onClick={importer.reset}
            tone="pink"
          >
            {state.step === "added" ? "Import another file" : "Start over"}
          </ArcadeActionButton>
        )}
      </div>
    </div>
  );
}
