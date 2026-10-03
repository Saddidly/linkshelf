import { describe, expect, it } from "vitest";
import {
  matchesSearchQuery,
  parseSearchQuery,
} from "./search.js";

describe("bookmark search grammar", () => {
  it("parses mixed fields, quoted phrases, and negated terms", () => {
    expect(
      parseSearchQuery('"design systems" tag:research collection:"Reading list" site:example.org -draft'),
    ).toEqual([
      { field: "text", value: "design systems", negated: false },
      { field: "tag", value: "research", negated: false },
      { field: "collection", value: "reading list", negated: false },
      { field: "site", value: "example.org", negated: false },
      { field: "text", value: "draft", negated: true },
    ]);
  });

  it("reports malformed fields, empty values, quotes, and negation", () => {
    for (const query of ["tag:", '"unfinished', '""', "-", "unknown:value"])
      expect(() => parseSearchQuery(query), query).toThrow();
  });

  it("keeps pasted web addresses searchable and accepts spaced or escaped phrases", () => {
    expect(parseSearchQuery("https://example.org/guide")).toEqual([
      { field: "text", value: "https://example.org/guide", negated: false },
    ]);
    expect(parseSearchQuery('tag: "research \\"notes\\""')).toEqual([
      { field: "tag", value: 'research "notes"', negated: false },
    ]);
  });

  it("combines clauses with AND and searches field-specific values", () => {
    const bookmark = {
      title: "Design systems guide",
      url: "https://docs.example.org/guide",
      tags: ["research", "reading"],
      collectionId: "reading",
    };
    const collections = new Map([["reading", { name: "Reading list" }]]);
    expect(
      matchesSearchQuery(
        bookmark,
        collections,
        parseSearchQuery('"design systems" tag:research collection:"Reading list" site:example.org -draft'),
      ),
    ).toBe(true);
    expect(
      matchesSearchQuery(
        bookmark,
        collections,
        parseSearchQuery("tag:research -site:example.org"),
      ),
    ).toBe(false);
  });
});
