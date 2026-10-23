import type { StatusTone } from "../arcade/status-lamp.tsx";

// A small light that says how something is doing. Decoration only: the words beside it carry the meaning.
export function StatusDot({ tone }: { readonly tone: StatusTone }) {
  return (
    <span aria-hidden="true" className={`status-dot status-dot--${tone}`} />
  );
}
