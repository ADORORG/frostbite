import {
  creatorAdmissionEventLabels,
  creatorApplicationStateLabels,
  type CreatorReviewDetail,
} from "@frostbite/shared/creator-admission";

// "2026-10-10 12:30 UTC": the time as it was recorded, the same on every machine.
function formatTime(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

// Everything that happened to the application, oldest first: who did what and when, the state it went to,
// what the applicant was told, and the private notes only staff see.
export function History({
  events,
}: {
  readonly events: CreatorReviewDetail["events"];
}) {
  return (
    <ol aria-label="History of this application" className="arcade-timeline">
      {events.map((event, index) => (
        <li key={`${event.createdAt}-${String(index)}`}>
          <strong>{creatorAdmissionEventLabels[event.action]}</strong>
          {` by ${event.actorName} on ${formatTime(event.createdAt)}, now ${creatorApplicationStateLabels[event.nextState]}`}
          {event.creatorFeedback === "" ? null : (
            <p className="arcade-quote">{`Told the applicant: ${event.creatorFeedback}`}</p>
          )}
          {event.privateNotes === "" ? null : (
            <p className="arcade-quote">{`Private note: ${event.privateNotes}`}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
