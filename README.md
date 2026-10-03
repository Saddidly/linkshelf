# LinkShelf

LinkShelf is a local-first bookmark shelf for people who want their saved links to stay searchable and under their control. Save links into collections, add tags, search across titles and addresses, and move your library between browsers with bookmark HTML or JSON.

## What it does

- Saves and edits HTTP or HTTPS bookmarks in browser IndexedDB. Nothing is uploaded to a LinkShelf service, and a fresh install starts empty.
- Organizes links into named collections and tags. Removing a collection moves its links to **Unsorted**.
- Searches bookmark titles, URLs, and tags; filters by tag; and sorts by date, title, or website.
- Imports Netscape bookmark HTML (including folder names), LinkShelf JSON backups, Chrome bookmark JSON exports, or a JSON array of `{ "title", "url", "tags", "collectionName" }` records.
- Previews imports, skips normalized URL duplicates, and reports invalid links before saving. Only HTTP and HTTPS links are accepted.
- Exports a versioned JSON backup or Netscape bookmark HTML.

## Run locally

Requires Node.js 22 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create and serve a production build:

```sh
npm run build
npm run preview
```

The production build is static and can be hosted from any static file server. Keep the site on the same origin when you want to keep using its saved IndexedDB data. Moving to a different origin starts a separate browser database; export a JSON backup first.

## Data and privacy

Bookmarks and collections stay in the browser profile, scoped to the site origin. Clearing site data, using a different browser profile, or opening the app on a different origin can remove or hide the local library. Export a JSON backup before clearing storage or changing origins. Imported URLs are syntax-checked and limited to HTTP(S); LinkShelf does not make background requests to check whether a remote page is reachable.

## Project layout

- `src/domain.js` contains URL validation, normalized duplicate keys, and tag cleanup.
- `src/transfer.js` parses supported bookmark formats, creates import previews, and writes export formats.
- `src/repository.js` is the IndexedDB persistence boundary.
- `src/main.js` renders the accessible browser UI and connects it to those modules.
- `fixtures/` contains deliberately small files for exercising the import paths; no fixture is loaded into a new library.

See [ARCHITECTURE.md](ARCHITECTURE.md) for storage and import tradeoffs.

## Development

```sh
npm test
npm run build
```

The tests cover URL policy and normalization, duplicate handling, HTML and Chrome JSON parsing, export escaping, and the IndexedDB repository. See [CONTRIBUTING.md](CONTRIBUTING.md) for change expectations.

## Preview

Synthetic example data from the local browser check.

![linkshelf interface](docs/images/mobile.png)
