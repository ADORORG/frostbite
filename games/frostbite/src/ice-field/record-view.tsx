import * as React from "react";
import { canonicalJson, type RunRecord } from "@ador/game-sdk/run-record";

import { submitNote, type SubmitState } from "./platform-run.ts";

// What a finished run leaves: a summary and the record itself, in a text box to select and copy (the frame has no
// clipboard permission). The record is the canonical text the platform measures and hashes. What it says about the run is
// what the platform said: replay-checked only when it replayed the record, otherwise the player's own claim.
export function RecordView({
  onAgain,
  record,
  submit,
}: {
  readonly onAgain: () => void;
  readonly record: RunRecord;
  // What became of the record sent to the platform; null when none was sent.
  readonly submit: SubmitState | null;
}) {
  return (
    <section aria-label="Run record" className="if-record">
      <h3>Run recorded</h3>
      <p>
        {record.inputs.length} steps from seed {record.seed}.{" "}
        {record.claims.length === 0
          ? "No milestone was earned in this run."
          : `Claims: ${record.claims.join(", ")}.`}
      </p>
      <p className="if-note" role="status">
        {submitNote(submit)}
      </p>
      <label>
        The record
        <textarea
          className="if-record-text"
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          rows={6}
          value={canonicalJson(record)}
        />
      </label>
      <button className="if-button" onClick={onAgain} type="button">
        Start another run
      </button>
    </section>
  );
}
