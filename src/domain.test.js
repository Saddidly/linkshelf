import { describe, expect, it } from "vitest";
import { cleanTags, normalizeUrl, validateUrl } from "./domain.js";
import {
  parseImportFile,
  prepareImport,
  createHtmlExport,
  createJsonExport,
} from "./transfer.js";
import { createRepository } from "./repository.js";
import { IDBFactory } from "fake-indexeddb";

describe("bookmark URL rules", () => {
  it("adds https to bare domains and strips fragments and tracking parameters for deduplication", () => {
    expect(validateUrl("example.com/story")).toEqual({
      valid: true,
      url: "https://example.com/story",
    });
    expect(
      normalizeUrl(
        "HTTPS://Example.COM/story/?utm_source=letter&ref=home#part",
      ),
    ).toBe("https://example.com/story?ref=home");
  });

  it("rejects unsafe schemes and credential-bearing links", () => {
    expect(validateUrl("javascript:alert(1)").valid).toBe(false);
    expect(validateUrl("https://person:secret@example.com").valid).toBe(false);
    expect(validateUrl("not a URL").valid).toBe(false);
  });

  it("trims tags, collapses whitespace, and de-duplicates case-insensitively", () => {
    expect(
      cleanTags("  design systems, design Systems,  reading   list  "),
    ).toEqual(["design systems", "reading list"]);
  });
});

describe("bookmark import and export", () => {
  it("parses Chrome bookmark JSON folders", () => {
    const records = parseImportFile(
      JSON.stringify({
        roots: {
          bookmark_bar: {
            name: "Bookmarks bar",
            children: [
              {
                type: "folder",
                name: "Research",
                children: [
                  {
                    type: "url",
                    name: "Paper",
                    url: "https://example.org/paper",
                  },
                ],
              },
            ],
          },
        },
      }),
      "chrome.json",
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      title: "Paper",
      url: "https://example.org/paper",
      collectionName: "Bookmarks bar / Research",
    });
  });

  it("reads nested Netscape bookmark folders and rejects invalid and duplicate URLs", () => {
    const html =
      '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><H3>Reading</H3><DL><p><DT><A HREF="https://example.org/guide?utm_source=old">Guide</A><DT><A HREF="javascript:alert(1)">Bad</A></DL><DT><A HREF="https://outside.org/">Outside</A></DL>';
    const parsed = parseImportFile(html, "saved.html");
    const prepared = prepareImport(parsed, [
      { normalizedUrl: "https://example.org/guide" },
    ]);
    expect(prepared.ready).toHaveLength(1);
    expect(prepared.ready[0].title).toBe("Outside");
    expect(prepared.duplicates).toBe(1);
    expect(prepared.invalid).toBe(1);
  });

  it("round-trips the LinkShelf JSON contract and emits escaped Netscape HTML", () => {
    const collections = [{ id: "reading", name: "Reading & notes" }];
    const bookmarks = [
      {
        id: "one",
        title: "<Guide>",
        url: "https://example.org/?a=1&b=2",
        normalizedUrl: "https://example.org/?a=1&b=2",
        collectionId: "reading",
        tags: ["read"],
        addedAt: "2026-01-02T03:04:05.000Z",
      },
    ];
    const json = createJsonExport(
      collections,
      bookmarks,
      "2026-01-02T00:00:00.000Z",
    );
    expect(parseImportFile(json, "linkshelf.json")).toMatchObject([
      { title: "<Guide>", collectionName: "Reading & notes" },
    ]);
    expect(createHtmlExport(collections, bookmarks)).toContain("&lt;Guide&gt;");
    expect(createHtmlExport(collections, bookmarks)).toContain(
      "Reading &amp; notes",
    );
  });
});

describe("IndexedDB repository", () => {
  it("persists bookmarks, enforces normalized URL uniqueness, and rehomes links on collection deletion", async () => {
    const repository = createRepository(new IDBFactory());
    await repository.initialize();
    const collection = await repository.createCollection("Reading");
    await repository.saveBookmark({
      id: "one",
      title: "A guide",
      url: "https://example.org/guide?utm_campaign=spring",
      collectionId: collection.id,
      tags: ["read"],
    });
    expect(await repository.listBookmarks()).toHaveLength(1);
    await expect(
      repository.saveBookmark({
        id: "two",
        title: "Same guide",
        url: "https://example.org/guide#top",
        collectionId: "unsorted",
        tags: [],
      }),
    ).rejects.toThrow("already on your shelf");
    await repository.deleteCollection(collection.id);
    expect((await repository.listBookmarks())[0].collectionId).toBe("unsorted");
  });
});

describe("concurrent IndexedDB mutations", () => {
  it("serializes duplicate collection creation across two repository instances", async () => {
    const factory = new IDBFactory();
    const first = createRepository(factory),
      second = createRepository(factory);
    await first.initialize();
    const results = await Promise.allSettled([
      first.createCollection("Reading"),
      second.createCollection("reading"),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await first.listCollections()).toHaveLength(2);
  });

  it("keeps referential integrity when deletion overlaps a bookmark save", async () => {
    const factory = new IDBFactory();
    const first = createRepository(factory),
      second = createRepository(factory);
    await first.initialize();
    const collection = await first.createCollection("Temporary");
    await Promise.allSettled([
      first.saveBookmark({
        title: "Reference",
        url: "https://example.org/reference",
        collectionId: collection.id,
      }),
      second.deleteCollection(collection.id),
    ]);
    const ids = new Set((await first.listCollections()).map((row) => row.id));
    for (const bookmark of await first.listBookmarks())
      expect(ids.has(bookmark.collectionId)).toBe(true);
  });
});
