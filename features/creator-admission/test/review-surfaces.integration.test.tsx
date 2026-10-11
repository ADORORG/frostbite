import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReviewDetailSurface } from "../src/ui/detail-surface.tsx";
import { ReviewQueueSurface } from "../src/ui/queue-surface.tsx";
import { detail } from "./support/review-fixtures.ts";

describe("review page surfaces", () => {
  it("frames the queue as the staff's list of applications", () => {
    const markup = renderToStaticMarkup(<ReviewQueueSurface navigation={[]} />);
    expect(markup).toContain("<h1>Creator reviews</h1>");
    expect(markup).toContain("STAFF ONLY");
    expect(markup).toContain("Loading applications…");
  });

  it("frames one application and loads it in the browser", () => {
    const markup = renderToStaticMarkup(
      <ReviewDetailSurface
        applicationId={detail().applicationId}
        navigation={[]}
      />,
    );
    expect(markup).toContain("<h1>Review an application</h1>");
    expect(markup).toContain("Loading the application…");
  });
});
