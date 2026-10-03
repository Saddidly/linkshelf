import { cleanTags, makeId, normalizeUrl, validateUrl } from "./domain.js";

const DATABASE_NAME = "linkshelf";
const DATABASE_VERSION = 1;
const DEFAULT_COLLECTION = {
  id: "unsorted",
  name: "Unsorted",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("The browser could not read local data."),
      );
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("The change could not be saved."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("The change could not be saved."));
  });
}

export function createRepository(indexedDBApi = globalThis.indexedDB) {
  let databasePromise;

  function database() {
    if (!indexedDBApi)
      return Promise.reject(
        new Error("This browser does not support local IndexedDB storage."),
      );
    if (!databasePromise)
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDBApi.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("collections"))
            db.createObjectStore("collections", { keyPath: "id" }).createIndex(
              "name",
              "name",
              { unique: false },
            );
          if (!db.objectStoreNames.contains("bookmarks")) {
            const bookmarks = db.createObjectStore("bookmarks", {
              keyPath: "id",
            });
            bookmarks.createIndex("normalizedUrl", "normalizedUrl", {
              unique: true,
            });
            bookmarks.createIndex("collectionId", "collectionId", {
              unique: false,
            });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(
            request.error ??
              new Error("LinkShelf could not open its local database."),
          );
        request.onblocked = () =>
          reject(
            new Error(
              "Close other LinkShelf tabs so the local database can upgrade.",
            ),
          );
      });
    return databasePromise;
  }

  async function listCollections() {
    const db = await database();
    const tx = db.transaction("collections", "readonly");
    const done = transactionDone(tx);
    const result = await requestResult(tx.objectStore("collections").getAll());
    await done;
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function listBookmarks() {
    const db = await database();
    const tx = db.transaction("bookmarks", "readonly");
    const done = transactionDone(tx);
    const result = await requestResult(tx.objectStore("bookmarks").getAll());
    await done;
    return result;
  }

  async function mutate(stores, operation) {
    const db = await database();
    const tx = db.transaction(stores, "readwrite");
    const done = transactionDone(tx);
    // Attach a handler immediately: abort may occur while a request is awaited.
    done.catch(() => {});
    try {
      const result = await operation(tx);
      await done;
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* The transaction may already have ended. */
      }
      await done.catch(() => {});
      throw error;
    }
  }

  return {
    async initialize() {
      return mutate(["collections"], async (tx) => {
        const store = tx.objectStore("collections");
        if (!(await requestResult(store.get(DEFAULT_COLLECTION.id))))
          store.add(DEFAULT_COLLECTION);
      });
    },
    listCollections,
    listBookmarks,
    async createCollection(name) {
      const cleanName = String(name ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 60);
      if (!cleanName) throw new Error("Enter a collection name.");
      return mutate(["collections"], async (tx) => {
        const existing = await requestResult(
          tx.objectStore("collections").getAll(),
        );
        if (
          existing.some(
            (item) =>
              item.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase(),
          )
        )
          throw new Error("A collection with that name already exists.");
        const collection = {
          id: makeId(),
          name: cleanName,
          createdAt: new Date().toISOString(),
        };
        tx.objectStore("collections").add(collection);
        return collection;
      });
    },
    async renameCollection(id, name) {
      if (id === DEFAULT_COLLECTION.id)
        throw new Error("The Unsorted collection cannot be renamed.");
      const cleanName = String(name ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 60);
      if (!cleanName) throw new Error("Enter a collection name.");
      return mutate(["collections"], async (tx) => {
        const existing = await requestResult(
          tx.objectStore("collections").getAll(),
        );
        if (!existing.some((item) => item.id === id))
          throw new Error("That collection no longer exists.");
        if (
          existing.some(
            (item) =>
              item.id !== id &&
              item.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase(),
          )
        )
          throw new Error("A collection with that name already exists.");
        const updated = {
          ...existing.find((item) => item.id === id),
          name: cleanName,
        };
        tx.objectStore("collections").put(updated);
        return updated;
      });
    },
    async deleteCollection(id) {
      if (id === DEFAULT_COLLECTION.id)
        throw new Error("The Unsorted collection cannot be deleted.");
      return mutate(["collections", "bookmarks"], async (tx) => {
        const store = tx.objectStore("bookmarks");
        const bookmarks = await requestResult(
          store.index("collectionId").getAll(id),
        );
        for (const bookmark of bookmarks)
          store.put({ ...bookmark, collectionId: DEFAULT_COLLECTION.id });
        tx.objectStore("collections").delete(id);
      });
    },
    async saveBookmark(input) {
      const validation = validateUrl(input.url);
      if (!validation.valid) throw new Error(validation.message);
      return mutate(["collections", "bookmarks"], async (tx) => {
        const [collections, bookmarks] = await Promise.all([
          requestResult(tx.objectStore("collections").getAll()),
          requestResult(tx.objectStore("bookmarks").getAll()),
        ]);
        if (!collections.some((item) => item.id === input.collectionId))
          throw new Error("Choose an existing collection.");
        const normalizedUrl = normalizeUrl(validation.url);
        if (
          bookmarks.some(
            (item) =>
              item.normalizedUrl === normalizedUrl && item.id !== input.id,
          )
        )
          throw new Error("That link is already on your shelf.");
        const title = String(input.title ?? "")
          .trim()
          .slice(0, 200);
        if (!title) throw new Error("Add a title for this bookmark.");
        const existing = bookmarks.find((item) => item.id === input.id);
        const bookmark = {
          id: input.id || makeId(),
          title,
          url: validation.url,
          normalizedUrl,
          collectionId: input.collectionId,
          tags: cleanTags(input.tags),
          addedAt: existing?.addedAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        tx.objectStore("bookmarks").put(bookmark);
        return bookmark;
      });
    },
    async deleteBookmark(id) {
      return mutate(["bookmarks"], (tx) => {
        tx.objectStore("bookmarks").delete(id);
      });
    },
    async importBookmarks(records) {
      if (!records.length) return 0;
      return mutate(["collections", "bookmarks"], async (tx) => {
        const [collections, bookmarks] = await Promise.all([
          requestResult(tx.objectStore("collections").getAll()),
          requestResult(tx.objectStore("bookmarks").getAll()),
        ]);
        const knownUrls = new Set(bookmarks.map((item) => item.normalizedUrl));
        const collectionByName = new Map(
          collections.map((item) => [item.name.toLocaleLowerCase(), item]),
        );
        const newCollections = [];
        const imported = [];
        for (const record of records) {
          const validation = validateUrl(record.url);
          if (!validation.valid) continue;
          const normalizedUrl = normalizeUrl(validation.url);
          if (knownUrls.has(normalizedUrl)) continue;
          knownUrls.add(normalizedUrl);
          const name =
            String(record.collectionName ?? "Unsorted")
              .trim()
              .replace(/\s+/g, " ")
              .slice(0, 60) || "Unsorted";
          let collection = collectionByName.get(name.toLocaleLowerCase());
          if (!collection) {
            collection = {
              id: makeId(),
              name,
              createdAt: new Date().toISOString(),
            };
            collectionByName.set(name.toLocaleLowerCase(), collection);
            newCollections.push(collection);
          }
          imported.push({
            id: record.id || makeId(),
            title: String(record.title || new URL(validation.url).hostname)
              .trim()
              .slice(0, 200),
            url: validation.url,
            normalizedUrl,
            collectionId: collection.id,
            tags: cleanTags(record.tags),
            addedAt: record.addedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        if (!imported.length) return 0;
        const collectionStore = tx.objectStore("collections");
        const bookmarkStore = tx.objectStore("bookmarks");
        for (const item of newCollections) collectionStore.add(item);
        for (const item of imported) bookmarkStore.add(item);
        return imported.length;
      });
    },
  };
}
