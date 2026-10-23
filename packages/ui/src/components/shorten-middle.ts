// "tb1qrx…pj76": the start and the end of a long id, for a place with little room. A text that already fits is left whole, so a short
// one is never made longer or less clear.
export function shortenMiddle(
  text: string,
  {
    head = 6,
    tail = 4,
  }: { readonly head?: number; readonly tail?: number } = {},
): string {
  return text.length <= head + tail + 2
    ? text
    : `${text.slice(0, head)}…${text.slice(-tail)}`;
}
