import * as React from "react";
import { canonicalJson, type RunRecord } from "@ador/game-sdk/run-record";

// What a finished run leaves: a summary and the record itself, in a text box to select and copy (the frame has no
// clipboard permission). The record is the canonical text the platform measures and hashes. Nothing here says the run
// is verified: it can be replayed by the platform once submission exists, and until then the milestones are the player's
// own claim.
export function RecordView({
  onAgain,
  record,
}: {
  readonly onAgain: () => void;
  readonly record: RunRecord;
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
      <p className="if-note">
        Milestones earned here are your own claim today. The platform can replay
        this record to check it once submitting records opens.
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
