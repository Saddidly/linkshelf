import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { createRepository } from "./repository.js";

async function createShelf() {
  const factory = new IDBFactory();
  const repository = createRepository(factory);
  await repository.initialize();
  const reading = await repository.createCollection("Reading");
  await repository.saveBookmark({
    id: "first",
    title: "First reference",
    url: "https://example.org/first",
    collectionId: "unsorted",
    tags: ["existing"],
  });
  await repository.saveBookmark({
    id: "second",
    title: "Second reference",
    url: "https://example.org/second",
    collectionId: "unsorted",
    tags: [],
  });
  return { repository, reading, factory };
}

describe("atomic bulk bookmark changes", () => {
  it("moves, adds tags, and deletes selected bookmarks", async () => {
    const { repository, reading } = await createShelf();
    expect(await repository.moveBookmarks(["first", "second"], reading.id)).toBe(2);
    expect((await repository.listBookmarks()).every((row) => row.collectionId === reading.id)).toBe(true);
    expect(await repository.addTagsToBookmarks(["first", "second"], "shared, reviewed")).toBe(2);
    const records = await repository.listBookmarks();
    expect(records.find((row) => row.id === "first").tags).toEqual(["existing", "shared", "reviewed"]);
    expect(records.find((row) => row.id === "second").tags).toEqual(["shared", "reviewed"]);
    expect(await repository.deleteBookmarks(["first", "second"])).toBe(2);
    expect(await repository.listBookmarks()).toEqual([]);
  });

  it("validates every ID and input before writes, leaving the whole batch unchanged", async () => {
    const { repository, reading } = await createShelf();
    await expect(repository.moveBookmarks(["first", "missing"], reading.id)).rejects.toThrow("no longer exist");
    await expect(repository.moveBookmarks(["first"], "missing-collection")).rejects.toThrow("existing collection");
    await expect(repository.addTagsToBookmarks(["first", "missing"], "added")).rejects.toThrow("no longer exist");
    await expect(repository.addTagsToBookmarks(["first"], "x".repeat(33))).rejects.toThrow("32 characters");
    await expect(repository.addTagsToBookmarks(["first"], ["valid", 7])).rejects.toThrow("text values");
    await expect(repository.deleteBookmarks(["first", "missing"])).rejects.toThrow("no longer exist");

    expect(await repository.listBookmarks()).toMatchObject([
      { id: "first", collectionId: "unsorted", tags: ["existing"] },
      { id: "second", collectionId: "unsorted", tags: [] },
    ]);
  });

  it("serializes overlapping tag batches without losing either update", async () => {
    const { repository: first, factory } = await createShelf();
    const second = createRepository(factory);
    await second.initialize();
    await Promise.all([
      first.addTagsToBookmarks(["first"], ["from first"]),
      second.addTagsToBookmarks(["first"], ["from second"]),
    ]);
    const tags = (await first.listBookmarks()).find((row) => row.id === "first").tags;
    expect(tags).toHaveLength(3);
    expect(tags).toEqual(expect.arrayContaining(["existing", "from first", "from second"]));
  });
});
