import type { CollectionImportRowReport } from "@frostbite/shared/collections";
import { StatusLamp } from "@repo/ui/arcade";

import { describeImportProblem } from "../../client/import-copy.ts";
import type { ParsedRow } from "../../client/import-parse.ts";

// One line per item in the file: what it is, and whether it can be added. A line that cannot say why in
// the creator's own terms (the row number, the name, the image they wrote) is not worth showing.
export function ImportReport({
  plannedSupply,
  reports,
  rows,
}: {
  readonly plannedSupply: number;
  // What the server found for each row, once it has been asked; empty before that.
  readonly reports: readonly CollectionImportRowReport[];
  readonly rows: readonly ParsedRow[];
}) {
  return (
    <ul aria-label="Items in the file" className="arcade-scroll-list">
      {rows.map((parsed) => {
        const report = reports.find(({ row }) => row === parsed.number);
        const problems = parsed.ok
          ? (report?.problems ?? []).map((problem) =>
              describeImportProblem(problem, {
                imageFileName: parsed.row.imageFileName,
                plannedSupply,
              }),
            )
          : parsed.problems;
        const label = parsed.ok
          ? `${parsed.number}. ${parsed.row.name} (${parsed.row.imageFileName})`
          : `Item ${parsed.number}`;
        return (
          <li key={parsed.number}>
            <strong>{label}</strong>
            {problems.length > 0 ? (
              <span>
                {problems.map((message) => (
                  <StatusLamp
                    key={message}
                    label={message}
                    tone="unavailable"
                  />
                ))}
              </span>
            ) : (
              <StatusLamp
                label={report === undefined ? "Not checked yet." : "Ready."}
                tone={report === undefined ? "attention" : "ready"}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
