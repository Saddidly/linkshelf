import "./style.css";
import { createRepository } from "./repository.js";
import {
  parseImportFile,
  createJsonExport,
  createHtmlExport,
  prepareImport,
} from "./transfer.js";
import { normalizeUrl, validateUrl, makeId } from "./domain.js";
import { matchesSearchQuery, parseSearchQuery } from "./search.js";

const root = document.querySelector("#app");
const repository = createRepository();
const state = {
  collections: [],
  bookmarks: [],
  selectedCollection: "all",
  query: "",
  activeTag: "",
  pendingImport: null,
  selectedIds: new Set(),
};

root.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="LinkShelf home"><span class="brand-mark">L</span><span>linkshelf</span></a>
      <div class="top-actions">
        <button class="button button-quiet" id="import-open" type="button"><span aria-hidden="true">↥</span> Import</button>
        <button class="button button-primary" id="add-open" type="button"><span aria-hidden="true">＋</span> Add bookmark</button>
      </div>
    </header>
    <div class="workspace">
      <aside class="sidebar" aria-label="Collections">
        <div class="sidebar-label">LIBRARY</div>
        <nav id="collection-nav" class="collection-nav" aria-label="Bookmark collections"></nav>
        <button class="new-collection" id="collection-create" type="button"><span aria-hidden="true">＋</span> New collection</button>
        <div class="sidebar-bottom">
          <div class="sidebar-label">YOUR DATA</div>
          <button class="side-action" id="export-json" type="button"><span aria-hidden="true">↧</span> Export JSON</button>
          <button class="side-action" id="export-html" type="button"><span aria-hidden="true">↧</span> Export bookmarks HTML</button>
          <p class="privacy-note"><span aria-hidden="true">◉</span> Stored only in this browser</p>
        </div>
      </aside>
      <main class="main-content">
        <div class="content-heading">
          <div><p class="eyebrow">YOUR READING SPACE</p><h1 id="view-title">All bookmarks</h1><p class="subheading" id="view-subtitle">A calm place for the links worth keeping.</p></div>
          <div class="heading-count"><strong id="bookmark-count">0</strong><span>saved</span></div>
        </div>
        <div class="toolbar">
          <label class="search-box"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Search titles, links, and tags" autocomplete="off" aria-label="Search bookmarks" aria-describedby="search-help query-feedback"><kbd>Ctrl K</kbd></label>
          <div class="toolbar-right"><label class="sort-label" for="sort">Sort</label><select id="sort" aria-label="Sort bookmarks"><option value="recent">Recently added</option><option value="title">Title A to Z</option><option value="site">Website</option></select></div>
        </div>
        <p class="search-help" id="search-help">Use phrases, tag:, collection:, site:, and - to exclude. Terms are combined.</p>
        <p class="query-feedback error-text" id="query-feedback" role="alert" hidden></p>
        <div id="active-tags" class="active-tags" aria-label="Tag filters"></div>
        <section class="bulk-toolbar" aria-label="Bulk bookmark actions">
          <div class="bulk-selection">
            <label class="select-visible"><input id="select-visible" type="checkbox"> <span>Select visible results</span></label>
            <span class="selection-count" id="selection-count" role="status" aria-live="polite">0 selected</span>
            <button class="clear-selection" id="selection-clear" type="button" disabled>Clear selection</button>
          </div>
          <div class="bulk-actions">
            <label class="bulk-control"><span>Move to</span><select id="bulk-collection" aria-label="Move selected bookmarks to"></select></label>
            <button class="button button-quiet" id="bulk-move" type="button" disabled>Move</button>
            <label class="bulk-control bulk-tags-control"><span>Add tags</span><input id="bulk-tags" type="text" placeholder="e.g. review, archive" aria-label="Tags to add to selected bookmarks" autocomplete="off"></label>
            <button class="button button-quiet" id="bulk-tag" type="button" disabled>Add tags</button>
            <button class="button button-danger" id="bulk-delete" type="button" disabled>Delete selected</button>
          </div>
        </section>
        <div id="bookmarks" class="bookmark-grid" aria-live="polite"></div>
        <div id="empty-state" class="empty-state" hidden><div class="empty-icon" aria-hidden="true">↗</div><h2 id="empty-title">Your shelf is ready</h2><p id="empty-copy">Save a link you want to come back to. It will stay on this device.</p><button class="button button-primary" id="empty-add" type="button">Add your first bookmark</button></div>
      </main>
    </div>
  </div>
  <dialog id="bookmark-dialog" class="dialog-card" aria-labelledby="bookmark-dialog-title">
    <form id="bookmark-form" novalidate>
      <div class="dialog-heading"><div><p class="eyebrow">SAVE A LINK</p><h2 id="bookmark-dialog-title">Add bookmark</h2></div><button class="icon-button" type="button" data-close="bookmark-dialog" aria-label="Close">×</button></div>
      <input type="hidden" name="id">
      <label class="field-label" for="bookmark-url">URL</label><input class="text-field" id="bookmark-url" name="url" type="url" placeholder="https://example.com/article" required autocomplete="url"><p class="field-help" id="url-feedback">Paste a web address to save a page.</p>
      <label class="field-label" for="bookmark-title">Title</label><input class="text-field" id="bookmark-title" name="title" type="text" maxlength="200" placeholder="What is this page about?" required>
      <div class="form-row"><label class="field-group"><span class="field-label">Collection</span><select class="text-field" id="bookmark-collection" name="collectionId" required></select></label><label class="field-group"><span class="field-label">Tags</span><input class="text-field" name="tags" type="text" placeholder="design, ideas"></label></div>
      <div class="dialog-actions"><button class="button button-quiet" type="button" data-close="bookmark-dialog">Cancel</button><button class="button button-primary" id="bookmark-submit" type="submit">Save bookmark</button></div>
    </form>
  </dialog>
  <dialog id="collection-dialog" class="dialog-card dialog-small" aria-labelledby="collection-dialog-title">
    <form id="collection-form"><div class="dialog-heading"><div><p class="eyebrow">ORGANIZE</p><h2 id="collection-dialog-title">New collection</h2></div><button class="icon-button" type="button" data-close="collection-dialog" aria-label="Close">×</button></div><label class="field-label" for="collection-name">Collection name</label><input class="text-field" id="collection-name" name="name" maxlength="60" required placeholder="e.g. Design inspiration"><div class="dialog-actions"><button class="button button-quiet" type="button" data-close="collection-dialog">Cancel</button><button class="button button-primary" type="submit">Create collection</button></div></form>
  </dialog>
  <dialog id="import-dialog" class="dialog-card" aria-labelledby="import-dialog-title">
    <form id="import-form"><div class="dialog-heading"><div><p class="eyebrow">BRING YOUR LINKS</p><h2 id="import-dialog-title">Import bookmarks</h2></div><button class="icon-button" type="button" data-close="import-dialog" aria-label="Close">×</button></div><p class="dialog-copy">Choose an exported bookmarks HTML file or a LinkShelf or Chrome JSON file. Existing links are skipped.</p><label class="file-drop" for="import-file"><span class="file-icon" aria-hidden="true">↥</span><strong>Choose a file</strong><span id="file-name">HTML or JSON, up to 10 MB</span><input id="import-file" type="file" accept=".html,.htm,.json,text/html,application/json"></label><div id="import-preview" class="import-preview" hidden></div><div class="dialog-actions"><button class="button button-quiet" type="button" data-close="import-dialog">Cancel</button><button class="button button-primary" id="import-confirm" type="submit" disabled>Import bookmarks</button></div></form>
  </dialog>
  <dialog id="bulk-delete-dialog" class="dialog-card dialog-small" aria-labelledby="bulk-delete-title">
    <div class="dialog-heading"><div><p class="eyebrow">DELETE BOOKMARKS</p><h2 id="bulk-delete-title">Delete selected bookmarks?</h2></div><button class="icon-button" type="button" data-close="bulk-delete-dialog" aria-label="Close">×</button></div>
    <p class="dialog-copy" id="bulk-delete-copy"></p>
    <div class="dialog-actions"><button class="button button-quiet" type="button" data-close="bulk-delete-dialog">Cancel</button><button class="button button-danger" id="bulk-delete-confirm" type="button">Delete bookmarks</button></div>
  </dialog>
  <div class="toast-region" id="toast-region" aria-live="polite" aria-atomic="true"></div>
`;

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const byId = (id) => document.getElementById(id);
const showToast = (message, tone = "success") => {
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  byId("toast-region").append(toast);
  setTimeout(() => toast.remove(), 3600);
};
const openDialog = (id) => byId(id).showModal();
const closeDialog = (id) => byId(id).close();
const clearSelection = () => state.selectedIds.clear();

async function refresh() {
  [state.collections, state.bookmarks] = await Promise.all([
    repository.listCollections(),
    repository.listBookmarks(),
  ]);
  if (
    state.selectedCollection !== "all" &&
    !state.collections.some((item) => item.id === state.selectedCollection)
  )
    state.selectedCollection = "all";
  const existingIds = new Set(state.bookmarks.map((bookmark) => bookmark.id));
  state.selectedIds = new Set(
    [...state.selectedIds].filter((id) => existingIds.has(id)),
  );
  render();
}

function render() {
  const activeCollection = state.collections.find(
    (item) => item.id === state.selectedCollection,
  );
  byId("view-title").textContent = activeCollection?.name ?? "All bookmarks";
  byId("view-subtitle").textContent = activeCollection
    ? "Everything you have saved in this collection."
    : "A calm place for the links worth keeping.";
  byId("bookmark-count").textContent = state.bookmarks.length;
  const collectionButtons = [
    {
      id: "all",
      name: "All bookmarks",
      icon: "◫",
      count: state.bookmarks.length,
    },
    ...state.collections.map((item) => ({
      ...item,
      icon: "▱",
      count: state.bookmarks.filter(
        (bookmark) => bookmark.collectionId === item.id,
      ).length,
    })),
  ];
  byId("collection-nav").innerHTML = collectionButtons
    .map(
      (item) =>
        `<div class="collection-row"><button class="collection-link ${state.selectedCollection === item.id ? "selected" : ""}" data-collection="${escapeHtml(item.id)}" type="button"><span class="collection-icon" aria-hidden="true">${item.icon}</span><span class="collection-name">${escapeHtml(item.name)}</span><span class="collection-count">${item.count}</span></button>${item.id !== "unsorted" && item.id !== "all" ? `<button class="collection-menu icon-button" data-menu="${escapeHtml(item.id)}" type="button" aria-label="Manage ${escapeHtml(item.name)}">···</button>` : ""}</div>`,
    )
    .join("");
  const collectionSelect = byId("bookmark-collection");
  const currentCollection = collectionSelect.value;
  collectionSelect.innerHTML = state.collections
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`,
    )
    .join("");
  if (state.collections.some((item) => item.id === currentCollection))
    collectionSelect.value = currentCollection;
  const bulkCollection = byId("bulk-collection");
  const currentBulkCollection = bulkCollection.value;
  bulkCollection.innerHTML = state.collections
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`,
    )
    .join("");
  if (state.collections.some((item) => item.id === currentBulkCollection))
    bulkCollection.value = currentBulkCollection;
  let clauses = [];
  let queryError = "";
  try {
    clauses = parseSearchQuery(state.query);
  } catch (error) {
    queryError = error.message;
  }
  byId("query-feedback").hidden = !queryError;
  byId("query-feedback").textContent = queryError;
  const collectionById = new Map(
    state.collections.map((collection) => [collection.id, collection]),
  );
  let visible = state.bookmarks.filter(
    (bookmark) =>
      state.selectedCollection === "all" ||
      bookmark.collectionId === state.selectedCollection,
  );
  if (queryError) visible = [];
  else if (clauses.length)
    visible = visible.filter((bookmark) =>
      matchesSearchQuery(bookmark, collectionById, clauses),
    );
  if (state.activeTag)
    visible = visible.filter((bookmark) =>
      bookmark.tags.includes(state.activeTag),
    );
  const sort = byId("sort").value;
  visible.sort(
    sort === "title"
      ? (a, b) => a.title.localeCompare(b.title)
      : sort === "site"
        ? (a, b) =>
            new URL(a.url).hostname.localeCompare(new URL(b.url).hostname)
        : (a, b) => b.addedAt.localeCompare(a.addedAt),
  );
  const visibleIds = new Set(visible.map((bookmark) => bookmark.id));
  state.selectedIds = new Set(
    [...state.selectedIds].filter((id) => visibleIds.has(id)),
  );
  byId("bookmarks").innerHTML = visible
    .map((bookmark) => {
      const host = new URL(bookmark.url).hostname.replace(/^www\./, "");
      const date = new Date(bookmark.addedAt);
      const saved = Number.isNaN(date.getTime())
        ? "Recently"
        : new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(date);
      return `<article class="bookmark-card"><div class="card-top"><label class="bookmark-select"><input data-select="${escapeHtml(bookmark.id)}" type="checkbox" aria-label="Select ${escapeHtml(bookmark.title)}" ${state.selectedIds.has(bookmark.id) ? "checked" : ""}><span class="sr-only">Select bookmark</span></label><span class="site-avatar" aria-hidden="true">${escapeHtml((host[0] ?? "↗").toUpperCase())}</span><div class="site-meta"><span class="site-name">${escapeHtml(host)}</span><span class="saved-date">Saved ${escapeHtml(saved)}</span></div><div class="card-actions"><button class="icon-button card-edit" data-edit="${escapeHtml(bookmark.id)}" type="button" aria-label="Edit ${escapeHtml(bookmark.title)}">✎</button><button class="icon-button card-delete" data-delete="${escapeHtml(bookmark.id)}" type="button" aria-label="Delete ${escapeHtml(bookmark.title)}">×</button></div></div><h2 class="card-title"><a href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(bookmark.title)}</a></h2><p class="card-url">${escapeHtml(bookmark.url)}</p><div class="card-bottom"><span class="card-collection">${escapeHtml(state.collections.find((item) => item.id === bookmark.collectionId)?.name ?? "Unsorted")}</span><div class="tag-list">${bookmark.tags.map((tag) => `<button class="tag-chip ${state.activeTag === tag ? "active" : ""}" type="button" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}</div></div></article>`;
    })
    .join("");
  const tags = [
    ...new Set(state.bookmarks.flatMap((bookmark) => bookmark.tags)),
  ].sort((a, b) => a.localeCompare(b));
  byId("active-tags").innerHTML = tags.length
    ? `<span class="tags-label">FILTER BY TAG</span>${tags.map((tag) => `<button class="tag-filter ${state.activeTag === tag ? "active" : ""}" type="button" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}${state.activeTag ? '<button class="clear-filter" type="button" data-clear-tag>Clear</button>' : ""}`
    : "";
  const isEmpty = visible.length === 0;
  byId("empty-state").hidden = !isEmpty;
  byId("bookmarks").hidden = isEmpty;
  const selectedVisibleCount = visible.filter((bookmark) =>
    state.selectedIds.has(bookmark.id),
  ).length;
  const selectVisible = byId("select-visible");
  selectVisible.checked = visible.length > 0 && selectedVisibleCount === visible.length;
  selectVisible.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visible.length;
  selectVisible.disabled = visible.length === 0;
  byId("selection-count").textContent = `${state.selectedIds.size} selected`;
  byId("selection-clear").disabled = state.selectedIds.size === 0;
  for (const id of ["bulk-move", "bulk-tag", "bulk-delete"])
    byId(id).disabled = state.selectedIds.size === 0;
  byId("bulk-delete-copy").textContent = `${state.selectedIds.size} selected bookmark${state.selectedIds.size === 1 ? " will" : "s will"} be permanently deleted. This cannot be undone.`;
  const filtered = Boolean(
    state.query.trim() ||
    state.activeTag ||
    state.selectedCollection !== "all",
  );
  byId("empty-title").textContent = filtered
    ? "No bookmarks found"
    : "Your shelf is ready";
  byId("empty-copy").textContent = filtered
    ? "Try a different search or clear your tag filter."
    : "Save a link you want to come back to. It will stay on this device.";
  byId("empty-add").hidden = filtered;
}

function openBookmark(bookmark) {
  const form = byId("bookmark-form");
  form.reset();
  form.elements.id.value = bookmark?.id ?? "";
  form.elements.url.value = bookmark?.url ?? "";
  form.elements.title.value = bookmark?.title ?? "";
  form.elements.collectionId.value =
    bookmark?.collectionId ?? state.collections[0]?.id ?? "";
  form.elements.tags.value = bookmark?.tags.join(", ") ?? "";
  byId("bookmark-dialog-title").textContent = bookmark
    ? "Edit bookmark"
    : "Add bookmark";
  byId("bookmark-submit").textContent = bookmark
    ? "Save changes"
    : "Save bookmark";
  byId("url-feedback").textContent = bookmark
    ? "Update the address or keep it as it is."
    : "Paste a web address to save a page.";
  openDialog("bookmark-dialog");
  setTimeout(() => byId("bookmark-url").focus(), 0);
}

byId("add-open").addEventListener("click", () => openBookmark());
byId("empty-add").addEventListener("click", () => openBookmark());
byId("import-open").addEventListener("click", () => {
  byId("import-form").reset();
  byId("import-preview").hidden = true;
  byId("import-confirm").disabled = true;
  byId("file-name").textContent = "HTML or JSON, up to 10 MB";
  state.pendingImport = null;
  openDialog("import-dialog");
});
byId("collection-create").addEventListener("click", () => {
  byId("collection-form").reset();
  openDialog("collection-dialog");
});

document.addEventListener("click", async (event) => {
  const close = event.target.closest("[data-close]");
  if (close) {
    closeDialog(close.dataset.close);
    return;
  }
  const collection = event.target.closest("[data-collection]");
  if (collection) {
    clearSelection();
    state.selectedCollection = collection.dataset.collection;
    state.activeTag = "";
    render();
    return;
  }
  const menu = event.target.closest("[data-menu]");
  if (menu) {
    const existing = state.collections.find(
      (item) => item.id === menu.dataset.menu,
    );
    const action = prompt(
      `Rename “${existing.name}” or type DELETE to remove it.`,
      existing.name,
    );
    if (action == null) return;
    if (action.trim().toLocaleLowerCase() === "delete") {
      if (
        confirm(`Delete “${existing.name}” and move its bookmarks to Unsorted?`)
      ) {
        await repository.deleteCollection(existing.id);
        clearSelection();
        state.selectedCollection = "all";
        await refresh();
        showToast("Collection deleted; bookmarks moved to Unsorted.");
      }
    } else {
      try {
        const changed = await repository.renameCollection(existing.id, action);
        clearSelection();
        await refresh();
        showToast(`Collection renamed to ${changed.name}.`);
      } catch (error) {
        showToast(error.message, "error");
      }
    }
    return;
  }
  const tag = event.target.closest("[data-tag]");
  if (tag) {
    clearSelection();
    state.activeTag =
      state.activeTag === tag.dataset.tag ? "" : tag.dataset.tag;
    render();
    return;
  }
  if (event.target.closest("[data-clear-tag]")) {
    clearSelection();
    state.activeTag = "";
    render();
    return;
  }
  const edit = event.target.closest("[data-edit]");
  if (edit) {
    openBookmark(state.bookmarks.find((item) => item.id === edit.dataset.edit));
    return;
  }
  const del = event.target.closest("[data-delete]");
  if (del && confirm("Delete this bookmark from your shelf?")) {
    await repository.deleteBookmark(del.dataset.delete);
    await refresh();
    showToast("Bookmark deleted.");
  }
});

byId("search").addEventListener("input", (event) => {
  clearSelection();
  state.query = event.target.value;
  render();
});
byId("select-visible").addEventListener("change", (event) => {
  const visibleIds = [...document.querySelectorAll("#bookmarks [data-select]")].map(
    (input) => input.dataset.select,
  );
  for (const id of visibleIds) {
    if (event.target.checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
  }
  render();
});
byId("bookmarks").addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-select]");
  if (!checkbox) return;
  const selectedId = checkbox.dataset.select;
  if (checkbox.checked) state.selectedIds.add(selectedId);
  else state.selectedIds.delete(selectedId);
  render();
  [...byId("bookmarks").querySelectorAll("[data-select]")]
    .find((input) => input.dataset.select === selectedId)
    ?.focus();
});
byId("selection-clear").addEventListener("click", () => {
  clearSelection();
  render();
});
byId("bulk-move").addEventListener("click", async () => {
  const ids = [...state.selectedIds];
  if (!ids.length) return;
  try {
    const count = await repository.moveBookmarks(
      ids,
      byId("bulk-collection").value,
    );
    clearSelection();
    await refresh();
    showToast(`${count} bookmark${count === 1 ? "" : "s"} moved.`);
  } catch (error) {
    showToast(error.message, "error");
  }
});
byId("bulk-tag").addEventListener("click", async () => {
  const ids = [...state.selectedIds];
  if (!ids.length) return;
  try {
    const count = await repository.addTagsToBookmarks(ids, byId("bulk-tags").value);
    clearSelection();
    byId("bulk-tags").value = "";
    await refresh();
    showToast(`Tags added to ${count} bookmark${count === 1 ? "" : "s"}.`);
  } catch (error) {
    showToast(error.message, "error");
  }
});
byId("bulk-delete").addEventListener("click", () => {
  if (state.selectedIds.size) openDialog("bulk-delete-dialog");
});
byId("bulk-delete-confirm").addEventListener("click", async () => {
  const ids = [...state.selectedIds];
  if (!ids.length) return;
  try {
    const count = await repository.deleteBookmarks(ids);
    clearSelection();
    closeDialog("bulk-delete-dialog");
    await refresh();
    showToast(`${count} bookmark${count === 1 ? "" : "s"} deleted.`);
  } catch (error) {
    showToast(error.message, "error");
  }
});
byId("sort").addEventListener("change", render);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    byId("search").focus();
  }
});
byId("bookmark-url").addEventListener("input", (event) => {
  const result = validateUrl(event.target.value);
  byId("url-feedback").textContent = event.target.value.trim()
    ? result.valid
      ? `Valid web address · ${new URL(result.url).hostname}`
      : result.message
    : "Paste a web address to save a page.";
  byId("url-feedback").className =
    `field-help ${event.target.value.trim() && !result.valid ? "error-text" : ""}`;
  const title = byId("bookmark-form").elements.title;
  if (result.valid && !title.value.trim())
    title.value = new URL(result.url).hostname.replace(/^www\./, "");
});
byId("bookmark-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = validateUrl(form.elements.url.value);
  if (!result.valid) {
    byId("bookmark-url").focus();
    showToast(result.message, "error");
    return;
  }
  const isEdit = Boolean(form.elements.id.value);
  const payload = {
    id: form.elements.id.value || makeId(),
    url: result.url,
    normalizedUrl: normalizeUrl(result.url),
    title: form.elements.title.value.trim(),
    collectionId: form.elements.collectionId.value,
    tags: form.elements.tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
  try {
    await repository.saveBookmark(payload);
    clearSelection();
    closeDialog("bookmark-dialog");
    await refresh();
    showToast(isEdit ? "Bookmark updated." : "Bookmark saved.");
  } catch (error) {
    showToast(error.message, "error");
  }
});
byId("collection-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const item = await repository.createCollection(
      byId("collection-name").value,
    );
    clearSelection();
    state.selectedCollection = item.id;
    closeDialog("collection-dialog");
    await refresh();
    showToast(`Collection “${item.name}” created.`);
  } catch (error) {
    showToast(error.message, "error");
  }
});

byId("import-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  state.pendingImport = null;
  byId("import-confirm").disabled = true;
  byId("import-preview").hidden = true;
  if (!file) return;
  byId("file-name").textContent = file.name;
  if (file.size > 10 * 1024 * 1024) {
    showToast("Choose a file smaller than 10 MB.", "error");
    return;
  }
  try {
    const records = parseImportFile(await file.text(), file.name);
    const preview = prepareImport(records, state.bookmarks);
    state.pendingImport = preview;
    byId("import-preview").hidden = false;
    byId("import-preview").innerHTML =
      `<strong>${preview.ready.length} new bookmarks ready</strong><span>${preview.duplicates} duplicate${preview.duplicates === 1 ? "" : "s"} will be skipped · ${preview.invalid} invalid link${preview.invalid === 1 ? "" : "s"} ignored</span>`;
    byId("import-confirm").disabled = preview.ready.length === 0;
  } catch (error) {
    byId("import-preview").hidden = false;
    byId("import-preview").innerHTML =
      `<strong>Could not read this file</strong><span>${escapeHtml(error.message)}</span>`;
    showToast("This file could not be imported.", "error");
  }
});
byId("import-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.pendingImport?.ready.length) return;
  try {
    const count = await repository.importBookmarks(state.pendingImport.ready);
    closeDialog("import-dialog");
    await refresh();
    showToast(`${count} bookmark${count === 1 ? "" : "s"} imported.`);
  } catch (error) {
    showToast(error.message, "error");
  }
});

function download(name, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
byId("export-json").addEventListener("click", async () =>
  download(
    "linkshelf-backup.json",
    createJsonExport(
      await repository.listCollections(),
      await repository.listBookmarks(),
    ),
    "application/json",
  ),
);
byId("export-html").addEventListener("click", async () =>
  download(
    "bookmarks.html",
    createHtmlExport(
      await repository.listCollections(),
      await repository.listBookmarks(),
    ),
    "text/html",
  ),
);

await repository.initialize();
await refresh();
