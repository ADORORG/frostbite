// The link to a transaction on a block explorer: the configured address with `{id}` replaced by the transaction's id. Null where the
// address is not one that can name a transaction (no `{id}`), so a page never links to the explorer's front page and calls it the
// transaction. The id comes from the platform's own build of the transaction, and is encoded all the same.
export const explorerLink = (template: string, id: string): string | null =>
  template.includes("{id}")
    ? template.replace("{id}", encodeURIComponent(id))
    : null;
