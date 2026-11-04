import { describe, expect, it } from "vitest";

import { httpErrorReasonSchema } from "../src/http/index.ts";
import {
  describeUploadFormats,
  isUploadOutcome,
  uploadOutcomeMessage,
  uploadOutcomes,
  type UploadOutcome,
} from "../src/uploads/outcomes.ts";

const names = Object.keys(uploadOutcomes) as UploadOutcome[];

describe("the catalogue of upload outcomes", () => {
  it("gives every outcome a reason the error envelope accepts, a status class the server can answer with, and words", () => {
    for (const name of names) {
      expect(httpErrorReasonSchema.safeParse(name).success, name).toBe(true);
      expect(uploadOutcomes[name].http, name).not.toBeNull();
      expect(uploadOutcomes[name].message.length, name).toBeGreaterThan(20);
    }
  });

  it("says each thing once: no two outcomes share a sentence", () => {
    const sentences = names.map((name) => uploadOutcomes[name].message);
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it("tells apart the two ways a conflict can happen, which a status class alone cannot", () => {
    expect(uploadOutcomes["upload-limit-reached"].http).toBe("conflict");
    expect(uploadOutcomes["file-not-arrived"].http).toBe("conflict");
    expect(uploadOutcomeMessage("upload-limit-reached")).not.toBe(
      uploadOutcomeMessage("file-not-arrived"),
    );
    expect(uploadOutcomeMessage("file-not-arrived")).not.toContain("limit");
  });

  it("recognises only its own reasons, and nothing a server merely says", () => {
    expect(isUploadOutcome("file-not-arrived")).toBe(true);
    expect(isUploadOutcome("signed-out")).toBe(false);
    expect(isUploadOutcome("toString")).toBe(false);
    expect(isUploadOutcome(null)).toBe(false);
  });

  it("uses the catalogue's words even when the server sent its own, since none asks for the server's", () => {
    expect(uploadOutcomeMessage("upload-not-found", "something else")).toBe(
      uploadOutcomes["upload-not-found"].message,
    );
  });
});

describe("the formats that may be uploaded, as a sentence needs them", () => {
  it("lists them to choose from, or to say what is allowed, in the same order", () => {
    expect(describeUploadFormats("or")).toBe("PNG, JPEG, or WebP");
    expect(describeUploadFormats("and")).toBe("PNG, JPEG, and WebP");
  });
});
