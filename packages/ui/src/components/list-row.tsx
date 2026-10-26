import type { ReactNode } from "react";

// One row of a plain list (the wallets of an account, the people holding a role): a picture or symbol, a name with a line under it, and
// what can be done to it, set apart from the next row by a rule and not by a box. Rows go in a `<ul className="list-rows">`.
export function ListRow({
  action,
  detail,
  leading,
  name,
}: {
  readonly action?: ReactNode;
  readonly detail?: ReactNode;
  readonly leading?: ReactNode;
  readonly name: ReactNode;
}) {
  return (
    <li className="list-row">
      {leading === undefined ? null : (
        <span className="list-row__leading">{leading}</span>
      )}
      <span className="list-row__text">
        <span className="list-row__name">{name}</span>
        {detail === undefined ? null : (
          <small className="list-row__detail">{detail}</small>
        )}
      </span>
      {action === undefined ? null : (
        <span className="list-row__action">{action}</span>
      )}
    </li>
  );
}
