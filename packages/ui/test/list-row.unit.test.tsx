import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ListRow } from "../src/arcade.ts";

describe("a row of a plain list", () => {
  it("shows its name, and its detail, picture and action only when it has them", () => {
    const bare = renderToStaticMarkup(
      <ul>
        <ListRow name="ada" />
      </ul>,
    );
    expect(bare).toContain("ada");
    expect(bare).not.toMatch(/list-row__(detail|leading|action)/u);
    const full = renderToStaticMarkup(
      <ul>
        <ListRow
          action={<button>Remove</button>}
          detail="Signet"
          leading={<i>i</i>}
          name="ada"
        />
      </ul>,
    );
    expect(full).toContain("Signet");
    expect(full).toContain("Remove");
    expect(full).toContain("list-row__leading");
  });
});
