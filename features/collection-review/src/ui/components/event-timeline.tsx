import {
  submissionActionPastLabels,
  submissionStateLabels,
  type ReviewEvent,
} from "@frostbite/shared/collections";

// Every event of the submission, oldest first, with what only staff see: who acted, the reason code,
// and the private notes. The creator sees none of this.
export function EventTimeline({
  events,
}: {
  readonly events: readonly ReviewEvent[];
}) {
  return (
    <section aria-label="History" className="arcade-form">
      <h3>History</h3>
      <ol>
        {events.map((event) => (
          <li key={`${event.createdAt}-${event.action}`}>
            <strong>
              {event.action === "submit"
                ? "Submitted by the creator"
                : `${event.actorName} ${submissionActionPastLabels[event.action]} it`}
            </strong>{" "}
            {`on ${event.createdAt.slice(0, 10)}, now ${submissionStateLabels[event.nextState]}`}
            <br />
            <small>{`${event.actorName} (${event.actorUserId}) · ${event.reasonCode}`}</small>
            {event.creatorFeedback === "" ? null : (
              <p>{`Told the creator: ${event.creatorFeedback}`}</p>
            )}
            {event.privateNotes === "" ? null : (
              <p>{`Private note: ${event.privateNotes}`}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
