import { beforeAll, describe, expect, it } from "vitest";

import {
  brokenProviders,
  collectionThrough,
  migrate,
  pagesFor,
  railFor,
  signedUrl,
  suspendCreator,
} from "./support/harness.tsx";

beforeAll(migrate);

describe("the public collection pages over the real database", () => {
  it("say the catalog is empty before anything is approved", async () => {
    const pages = await pagesFor();
    const markup = await pages.render("index");
    expect(markup).toContain("Catalog empty");
    expect(markup).toContain("No collections online");
  });

  it("show an approved collection, its frozen version with signed images, and nothing private", async () => {
    const approved = await collectionThrough("approved");
    const pages = await pagesFor();
    const index = await pages.render("index");
    expect(index).toContain("First light");
    expect(index).toContain(`href="/collections/${approved.collectionId}"`);
    expect(index).toContain(signedUrl(approved.coverKey));
    const detail = await pages.render("detail", approved.collectionId);
    for (const text of [
      "Not on sale yet",
      "First light",
      "About",
      "Items (1)",
      "Item 1",
    ])
      expect(detail).toContain(text);
    expect(detail).toContain(signedUrl(approved.coverKey));
    // Nothing of the creator, the review, or the records behind the page reaches the public.
    for (const secret of [
      approved.ownerUserId,
      approved.submissionId,
      "secret-reason-code",
      "private approval note",
      "private reviewer note",
      approved.payloadHash,
    ]) {
      expect(index).not.toContain(secret);
      expect(detail).not.toContain(secret);
    }
  });

  it("shows the landing page rail an approved collection with its picture and a link to it, over a moving background, and none of the creator's private records", async () => {
    const approved = await collectionThrough("approved");
    const markup = await railFor();
    expect(markup).toContain('id="collections"');
    expect(markup).toContain("First light");
    expect(markup).toContain(`href="/collections/${approved.collectionId}"`);
    expect(markup).toContain(signedUrl(approved.coverKey));
    expect(markup).toContain("scene-backdrop");
    for (const secret of [
      approved.ownerUserId,
      approved.submissionId,
      approved.payloadHash,
    ])
      expect(markup).not.toContain(secret);
    // A collection with its own picture keeps it uncovered.
    expect(markup).not.toContain("scene-overlay");
  });

  it("show nothing for a collection that is submitted or in review", async () => {
    const waiting = await collectionThrough("submitted");
    const inReview = await collectionThrough("under-review");
    const pages = await pagesFor();
    for (const hidden of [waiting, inReview]) {
      expect(await pages.render("detail", hidden.collectionId)).toContain(
        "Record not published",
      );
      expect(await pages.render("index")).not.toContain(
        `/collections/${hidden.collectionId}`,
      );
    }
  });

  it("stop showing a collection when its creator is no longer approved", async () => {
    const approved = await collectionThrough("approved");
    const pages = await pagesFor();
    expect(await pages.render("detail", approved.collectionId)).toContain(
      "Not on sale yet",
    );
    await suspendCreator(approved.ownerUserId);
    expect(await pages.render("detail", approved.collectionId)).toContain(
      "Record not published",
    );
    expect(await pages.render("index")).not.toContain(
      `/collections/${approved.collectionId}`,
    );
  });

  it("report an invalid address and an unknown one in different words", async () => {
    const pages = await pagesFor();
    expect(await pages.render("detail", "Not-A-Collection")).toContain(
      "Invalid identifier",
    );
    expect(
      await pages.render("detail", "018f22f2-9c1a-7b21-8c45-0000000000ff"),
    ).toContain("Record not published");
    expect(await pages.render("detail")).toContain("Invalid identifier");
  });

  it("say the catalog is unavailable, not empty, when it cannot be read", async () => {
    const pages = await pagesFor(brokenProviders);
    expect(await pages.render("index")).toContain("Catalog unavailable");
    const detail = await pages.render(
      "detail",
      "018f22f2-9c1a-7b21-8c45-0000000000ff",
    );
    expect(detail).toContain("Catalog unavailable");
    expect(detail).not.toContain("Record not published");
  });
});
