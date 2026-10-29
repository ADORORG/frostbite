import { standInInitials, standInTone } from "@repo/ui/arcade";

// What a minted milestone shows when no picture came with it (or while it is coming): its game's cover, dimmed and blurred, behind a
// round badge with the milestone's initials and a check for "minted". It is drawn from the name, so the same milestone always looks
// the same, and it makes no claim to be the picture; the detail view says it is a stand-in.
export function Medallion({
  cover,
  name,
}: {
  readonly cover: string | null;
  readonly name: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`medallion arcade-preview__stand-in--${String(standInTone(name))}`}
    >
      {cover === null ? null : (
        <img alt="" className="medallion__cover" src={cover} />
      )}
      <span className="medallion__badge">{standInInitials(name)}</span>
      <span className="medallion__check">&#10003;</span>
    </div>
  );
}
