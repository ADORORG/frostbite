import type { ReactNode } from "react";

// A menu that is a plain disclosure, so it opens with the keyboard and without any script: for the navigation, which must work before
// the page's code has loaded. It looks as `Popover` does (same trigger and panel), but unlike it does not close on a press elsewhere.
export function DetailsMenu({
  align = "end",
  children,
  className,
  current = false,
  label,
  trigger,
}: {
  readonly align?: "end" | "start";
  readonly children: ReactNode;
  readonly className?: string;
  // Whether the page being shown is inside this menu.
  readonly current?: boolean;
  readonly label: string;
  readonly trigger: ReactNode;
}) {
  return (
    <details className={`popover ${className ?? ""}`.trim()} data-align={align}>
      <summary
        className="popover__trigger"
        data-current={current ? "true" : undefined}
      >
        {trigger}
      </summary>
      <div aria-label={label} className="popover__panel" role="group">
        {children}
      </div>
    </details>
  );
}
