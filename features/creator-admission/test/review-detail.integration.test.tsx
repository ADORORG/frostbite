import { ApiError } from "@ador/client-http";
import { creatorReviewPath } from "@ador/shared/creator-admission";
import { act } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import type { CreatorReviewApi } from "../src/client/review-api.ts";
import { ReviewDetail } from "../src/ui/review-detail.tsx";
import { detail } from "./support/review-fixtures.ts";
import { button, click, mount } from "./support/mount.ts";

type ReadMock = Mock<CreatorReviewApi["read"]>;

let unmount: (() => Promise<void>) | null = null;
async function show(read: ReadMock, applicationId: string) {
  const view = await mount(
    <ReviewDetail
      applicationId={applicationId}
      services={{ api: { queue: vi.fn(), read } }}
    />,
  );
  unmount = view.unmount;
  return view.container;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
  await unmount?.();
  unmount = null;
  vi.unstubAllGlobals();
});

describe("creator review detail", () => {
  it("shows the version that was sent, its history, and the way back", async () => {
    const application = detail({ state: "submitted", submissionNumber: 3 });
    const read = vi
      .fn<CreatorReviewApi["read"]>()
      .mockResolvedValue({ application });
    const container = await show(read, application.applicationId);
    expect(read).toHaveBeenCalledWith(
      application.applicationId,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(container.textContent).toContain("Pixel games.");
    expect(container.textContent).toContain("submission 3");
    const history = container.querySelector("ol");
    expect(history?.textContent).toContain(
      "Sent the application by Ada Maker on 2026-10-10 12:30 UTC",
    );
    expect(history?.textContent).toContain(
      "Told the applicant: Add a portfolio link.",
    );
    expect(history?.textContent).toContain("Private note: Looks thin.");
    expect(
      container.querySelector(`a[href="${creatorReviewPath}"]`)?.textContent,
    ).toBe("Back to the queue");
  });

  it("lays what was sent and its history beside the decision, with each heading close to its content", async () => {
    const application = detail({ state: "submitted" });
    const read = vi
      .fn<CreatorReviewApi["read"]>()
      .mockResolvedValue({ application });
    const container = await show(read, application.applicationId);
    const columns = container.querySelector(".arcade-columns");
    if (columns === null) throw new Error("Expected the two-column layout");
    const [main, side] = [...columns.children];
    expect(main?.textContent).toContain("What the applicant sent");
    expect(main?.textContent).toContain("History");
    expect(side?.querySelector("form")).not.toBeNull();
    // A heading and its content share one tight stack, so no gap opens between them on a narrow screen.
    for (const name of ["What the applicant sent", "History"]) {
      expect(
        container.querySelector(`section[aria-label="${name}"]`)?.className,
      ).toContain("arcade-stack--tight");
    }
  });

  it("offers only the decisions the application's state allows", async () => {
    const application = detail({ state: "submitted" });
    const read = vi
      .fn<CreatorReviewApi["read"]>()
      .mockResolvedValue({ application });
    const container = await show(read, application.applicationId);
    const options = [
      ...(container
        .querySelector("select[name=action]")
        ?.querySelectorAll("option") ?? []),
    ].map((option) => option.value);
    expect(options).toEqual(["start-review"]);
  });

  it("says no decision is possible once an application can go no further", async () => {
    const application = detail({ state: "revoked" });
    const read = vi
      .fn<CreatorReviewApi["read"]>()
      .mockResolvedValue({ application });
    const container = await show(read, application.applicationId);
    expect(container.textContent).toContain(
      "No further decisions are possible for this application.",
    );
    expect(container.querySelector("form")).toBeNull();
  });

  it("reads the application again after a decision, so the page shows what the server holds", async () => {
    const application = detail({ state: "submitted" });
    const read = vi
      .fn<CreatorReviewApi["read"]>()
      .mockResolvedValueOnce({ application })
      .mockResolvedValue({
        application: { ...application, state: "under-review" },
      });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            application: {
              applicantUserId: application.applicationId,
              draft: application.snapshot,
              feedback: null,
              id: application.applicationId,
              revision: 1,
              state: "under-review",
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const container = await show(read, application.applicationId);
    const form = container.querySelector("form");
    if (form === null) throw new Error("Expected the decision form");
    await act(() => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Status: In review");
  });

  it("says an unknown application was not found, without offering a retry", async () => {
    const read = vi
      .fn<CreatorReviewApi["read"]>()
      .mockRejectedValue(new ApiError("not_found", 404, "missing"));
    const container = await show(read, detail().applicationId);
    expect(container.textContent).toContain(
      "This application could not be found.",
    );
    expect(container.textContent).not.toContain("Retry");
    expect(container.querySelector("form")).toBeNull();
  });

  it("offers a retry for a temporary fault and shows the application once it works", async () => {
    const application = detail();
    const read = vi
      .fn<CreatorReviewApi["read"]>()
      .mockRejectedValueOnce(new ApiError("network", null, "offline"))
      .mockResolvedValue({ application });
    const container = await show(read, application.applicationId);
    expect(container.textContent).toContain("could not reach the server");
    await click(button(container, "Retry"));
    expect(container.textContent).toContain("Pixel games.");
  });

  it("does not claim to have an application while loading", async () => {
    const read = vi
      .fn<CreatorReviewApi["read"]>()
      .mockReturnValue(new Promise(() => {}));
    const container = await show(read, detail().applicationId);
    expect(container.textContent).toContain("Loading the application…");
    expect(container.querySelector("form")).toBeNull();
  });
});
