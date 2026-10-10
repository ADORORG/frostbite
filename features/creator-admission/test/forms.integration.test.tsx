import { createUuidV7 } from "@ador/shared/identifiers";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreatorApplicationSurface } from "../src/ui/creator-application-surface.tsx";
import { sendCreatorAdmissionRequest } from "../src/ui/form-helpers.tsx";

const application = {
  applicantUserId: createUuidV7(),
  draft: {
    contentDeclarationAccepted: true,
    displayName: "Creator",
    expectedLaunchSize: "Small",
    expectedLaunchTiming: "After review",
    jurisdictionAcknowledged: true,
    portfolioLinks: [],
    projectSummary: "Summary",
    provenanceDeclarationAccepted: true,
    rightsDeclarationAccepted: true,
  },
  id: createUuidV7(),
  revision: 1,
  state: "draft" as const,
};

function response(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

async function render(
  mode: "studio" | "review",
  initial: typeof application | null = application,
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => {
    root.render(
      <CreatorApplicationSurface
        application={mode === "studio" ? initial : null}
        mode={mode}
        unavailable={false}
      />,
    );
  });
  return { container, root };
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("creator admission forms", () => {
  it("sends a private draft and reports the returned state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ application }));
    vi.stubGlobal("fetch", fetchMock);
    const { container, root } = await render("studio");
    const form = container.querySelector("form");
    if (form === null) throw new Error("Expected creator form");
    await act(() =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/creator-application/draft",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(container.textContent).toContain(
      "Private draft saved. State: draft",
    );
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await act(() =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(container.textContent).toContain("Draft save failed");
    await act(() => root.unmount());
  });

  it("submits a snapshot and reports request failure without a false success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ application }))
      .mockResolvedValueOnce(
        response({ application: { ...application, state: "submitted" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { container, root } = await render("studio");
    const declaration = container.querySelector<HTMLInputElement>(
      'input[name="rightsDeclarationAccepted"]',
    );
    if (declaration === null) throw new Error("Expected declaration field");
    await act(() => declaration.click());
    const submit = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Submit snapshot"),
    );
    if (submit === undefined) throw new Error("Expected submit button");
    expect(submit.disabled).toBe(true);
    expect(container.textContent).toContain(
      "Save this draft before submitting",
    );
    const form = container.querySelector("form");
    if (form === null) throw new Error("Expected creator form");
    await act(() =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(submit.disabled).toBe(false);
    await act(() => submit.click());
    // Sent: the card says so, and the form gives way to what was sent, so it cannot be sent twice.
    expect(container.textContent).toContain("Application submitted");
    expect(container.textContent).toContain("What you sent");
    expect(container.querySelector("form")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(() => root.unmount());
  });

  it("serializes an initially empty draft without inventing field values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ application }));
    vi.stubGlobal("fetch", fetchMock);
    const { container, root } = await render("studio", null);
    const form = container.querySelector("form");
    if (form === null) throw new Error("Expected creator form");
    const submit = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Submit snapshot"),
    );
    if (submit === undefined) throw new Error("Expected submit button");
    expect(submit.disabled).toBe(true);
    const portfolio = form.elements.namedItem("portfolioLinks");
    if (!(portfolio instanceof HTMLInputElement))
      throw new Error("Expected portfolio field");
    expect(portfolio.required).toBe(false);
    await act(() =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(fetchMock).toHaveBeenCalled();
    expect(submit.disabled).toBe(false);
    await act(() => root.unmount());
  });

  it("records reviewer success and renders reviewer failure truthfully", async () => {
    let finishFirstRequest: ((value: Response) => void) | undefined;
    const firstRequest = new Promise<Response>((resolve) => {
      finishFirstRequest = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstRequest)
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const { container, root } = await render("review");
    const form = container.querySelector("form");
    if (form === null) throw new Error("Expected review form");
    const evidence = form.elements.namedItem("evidenceReference");
    if (!(evidence instanceof HTMLInputElement))
      throw new Error("Expected evidence field");
    expect(evidence.required).toBe(false);
    const feedback = form.elements.namedItem("creatorFeedback");
    if (!(feedback instanceof HTMLInputElement))
      throw new Error("Expected feedback field");
    expect(feedback.required).toBe(false);
    evidence.value = "https://example.test/evidence";
    await act(() => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (finishFirstRequest === undefined)
      throw new Error("Expected pending review request");
    const completeFirstRequest = finishFirstRequest;
    await act(() => {
      completeFirstRequest(
        response({ application: { ...application, state: "under-review" } }),
      );
    });
    expect(container.textContent).toContain("State: under-review");
    evidence.value = "";
    await act(() =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(container.textContent).toContain("Decision was not recorded");
    await act(() => root.unmount());
  });

  it("rejects invalid successful payloads at the response boundary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ application: {} })),
    );
    await expect(
      sendCreatorAdmissionRequest("/api/v1/test", "POST", {}),
    ).rejects.toThrow();
  });

  it("rejects non-success HTTP responses before trusting their bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ application }, 403)),
    );
    await expect(
      sendCreatorAdmissionRequest("/api/v1/test", "POST", {}),
    ).rejects.toThrow("could not be completed");
  });
});
