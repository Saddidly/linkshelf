import { cleanTags, makeId, normalizeUrl, validateUrl } from "./domain.js";

const ROOT_COLLECTION = "Unsorted";

export function parseImportFile(contents, fileName = "") {
  const source = String(contents ?? "").trim();
  if (!source) throw new Error("The selected file is empty.");
  if (source.length > 10 * 1024 * 1024)
    throw new Error("Files must be smaller than 10 MB.");
  const looksLikeJson =
    /\.json$/i.test(fileName) ||
    source.startsWith("{") ||
    source.startsWith("[");
  if (looksLikeJson) {
    let value;
    try {
      value = JSON.parse(source);
    } catch {
      throw new Error("The JSON file could not be parsed.");
    }
    return parseJsonBookmarks(value);
  }
  if (typeof DOMParser === "undefined")
    throw new Error("HTML import is unavailable in this environment.");
  return parseHtmlBookmarks(source);
}

export function parseJsonBookmarks(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeRecord(item));
  if (!value || typeof value !== "object")
    throw new Error("The JSON file must contain a bookmark list.");
  if (
    value.format === "linkshelf" &&
    value.version === 1 &&
    Array.isArray(value.bookmarks)
  ) {
    const collections = new Map(
      (value.collections ?? []).map((item) => [item.id, item.name]),
    );
    return value.bookmarks.map((item) =>
      normalizeRecord({
        ...item,
        collectionName:
          item.collectionName ??
          collections.get(item.collectionId) ??
          ROOT_COLLECTION,
      }),
    );
  }
  if (Array.isArray(value.bookmarks))
    return value.bookmarks.map((item) => normalizeRecord(item));
  if (value.roots && typeof value.roots === "object") {
    const records = [];
    for (const root of Object.values(value.roots))
      walkChromeNode(root, [], records);
    return records;
  }
  throw new Error(
    "This JSON format is not recognized. Choose a LinkShelf backup or Chrome bookmarks export.",
  );
}

function normalizeRecord(item, collectionName = ROOT_COLLECTION) {
  if (!item || typeof item !== "object")
    return { url: "", title: "", tags: [], collectionName };
  return {
    url: String(item.url ?? item.href ?? ""),
    title: String(item.title ?? item.name ?? ""),
    tags: cleanTags(item.tags ?? item.tag ?? []),
    collectionName: String(
      item.collectionName ?? item.folder ?? collectionName ?? ROOT_COLLECTION,
    ),
    addedAt: validDate(item.addedAt ?? item.dateAdded),
  };
}

function walkChromeNode(node, path, records) {
  if (!node || typeof node !== "object") return;
  if (node.type === "url" || node.url) {
    records.push(
      normalizeRecord(
        { title: node.name ?? node.title, url: node.url },
        path.length ? path.join(" / ") : ROOT_COLLECTION,
      ),
    );
    return;
  }
  const nextPath = node.name ? [...path, String(node.name)] : path;
  for (const child of Array.isArray(node.children) ? node.children : [])
    walkChromeNode(child, nextPath, records);
}

export function parseHtmlBookmarks(source) {
  const document = new DOMParser().parseFromString(source, "text/html");
  if (!document.querySelector("a[href]"))
    throw new Error("No bookmark links were found in this HTML file.");
  const records = [];
  const walk = (container, path) => {
    let pendingFolder = "";
    for (const node of Array.from(container.children)) {
      const tag = node.tagName?.toUpperCase();
      if (tag === "H3") {
        pendingFolder = node.textContent.trim();
        continue;
      }
      if (tag === "A") {
        records.push(
          normalizeRecord(
            {
              title: node.textContent.trim(),
              url: node.getAttribute("href"),
              tags: node.getAttribute("tags")?.split(",") ?? [],
            },
            path.length ? path.join(" / ") : ROOT_COLLECTION,
          ),
        );
        continue;
      }
      if (tag === "DL") {
        walk(node, pendingFolder ? [...path, pendingFolder] : path);
        pendingFolder = "";
        continue;
      }
      if (tag === "DT") {
        const heading = Array.from(node.children).find(
          (child) => child.tagName?.toUpperCase() === "H3",
        );
        const anchor = Array.from(node.children).find(
          (child) => child.tagName?.toUpperCase() === "A",
        );
        const list = Array.from(node.children).find(
          (child) => child.tagName?.toUpperCase() === "DL",
        );
        if (anchor)
          records.push(
            normalizeRecord(
              {
                title: anchor.textContent.trim(),
                url: anchor.getAttribute("href"),
                tags: anchor.getAttribute("tags")?.split(",") ?? [],
              },
              path.length ? path.join(" / ") : ROOT_COLLECTION,
            ),
          );
        if (list)
          walk(list, heading ? [...path, heading.textContent.trim()] : path);
        continue;
      }
      if (tag === "P" || tag === "DIV" || tag === "BODY" || tag === "HTML")
        walk(node, path);
    }
  };
  const lists = Array.from(document.querySelectorAll("dl"));
  if (lists.length) walk(lists[0], []);
  else
    for (const anchor of document.querySelectorAll("a[href]"))
      records.push(
        normalizeRecord({
          title: anchor.textContent.trim(),
          url: anchor.getAttribute("href"),
        }),
      );
  return records;
}

function validDate(value) {
  const numeric = Number(value);
  const date =
    typeof value === "number" ||
    (Number.isFinite(numeric) &&
      numeric > 1000000000 &&
      String(value).length >= 10)
      ? new Date(numeric > 100000000000 ? numeric : numeric * 1000)
      : new Date(value ?? "");
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

export function prepareImport(records, existingBookmarks = []) {
  const seen = new Set(
    existingBookmarks
      .map((item) => item.normalizedUrl || safeNormalize(item.url))
      .filter(Boolean),
  );
  const ready = [];
  let duplicates = 0;
  let invalid = 0;
  for (const source of records) {
    const record = normalizeRecord(source);
    const validation = validateUrl(record.url);
    if (!validation.valid) {
      invalid += 1;
      continue;
    }
    const normalizedUrl = normalizeUrl(validation.url);
    if (seen.has(normalizedUrl)) {
      duplicates += 1;
      continue;
    }
    seen.add(normalizedUrl);
    const url = validation.url;
    const fallbackTitle = new URL(url).hostname.replace(/^www\./, "");
    ready.push({
      id: makeId(),
      url,
      normalizedUrl,
      title: record.title.trim().slice(0, 200) || fallbackTitle,
      tags: cleanTags(record.tags),
      collectionName:
        record.collectionName.trim().slice(0, 100) || ROOT_COLLECTION,
      addedAt: record.addedAt,
    });
  }
  return { ready, duplicates, invalid };
}

function safeNormalize(url) {
  try {
    return normalizeUrl(url);
  } catch {
    return "";
  }
}

export function createJsonExport(
  collections,
  bookmarks,
  exportedAt = new Date().toISOString(),
) {
  return JSON.stringify(
    {
      format: "linkshelf",
      version: 1,
      exportedAt,
      collections: collections.map(({ id, name }) => ({ id, name })),
      bookmarks: bookmarks.map(
        ({ id, title, url, normalizedUrl, collectionId, tags, addedAt }) => ({
          id,
          title,
          url,
          normalizedUrl,
          collectionId,
          tags,
          addedAt,
        }),
      ),
    },
    null,
    2,
  );
}

export function createHtmlExport(collections, bookmarks) {
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const groups = new Map(collections.map((collection) => [collection.id, []]));
  for (const bookmark of bookmarks)
    (groups.get(bookmark.collectionId) ?? groups.get("unsorted") ?? []).push(
      bookmark,
    );
  const renderBookmarks = (items) =>
    items
      .map(
        (bookmark) =>
          `<DT><A HREF="${escape(bookmark.url)}" ADD_DATE="${Math.floor(new Date(bookmark.addedAt).getTime() / 1000)}" TAGS="${escape(bookmark.tags.join(","))}">${escape(bookmark.title)}</A>`,
      )
      .join("\n");
  const content = collections
    .map((collection) => {
      const items = groups.get(collection.id) ?? [];
      if (!items.length) return "";
      return `<DT><H3>${escape(collection.name)}</H3>\n<DL><p>\n${renderBookmarks(items)}\n</DL><p>`;
    })
    .filter(Boolean)
    .join("\n");
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>LinkShelf bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${content}\n</DL><p>\n`;
}
