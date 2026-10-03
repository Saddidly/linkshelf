# Architecture and tradeoffs

## Shape

LinkShelf is a static browser application with small JavaScript modules around the UI. The domain module is pure and defines accepted URLs, tags, and duplicate keys. The search module parses and evaluates the documented phrase, field, and exclusion grammar. The transfer module translates external bookmark formats to records, and produces portable formats from saved records. The repository hides IndexedDB behind a narrow asynchronous interface. The UI does not access browser storage directly.

## Persistence

IndexedDB is used instead of localStorage because bookmark libraries can grow beyond the small string values localStorage is intended for, and database transactions allow bookmark and collection changes to be persisted as records. A unique index on `normalizedUrl` enforces duplicate prevention even if two save attempts overlap. The normalized key removes a URL fragment and common tracking parameters, removes an unnecessary trailing path slash, and lets the URL parser normalize host casing and default ports. It keeps meaningful query parameters and does not assume that `www` and non-`www` hosts are interchangeable.

Bulk move, tag-add, and delete methods open one readwrite transaction per action. IDs and tag input are checked before starting the transaction; the action then reads and verifies all selected records and the destination collection before queuing writes. A missing record, missing destination, invalid tag, or tag-limit overflow aborts the complete transaction. IndexedDB serializes overlapping readwrite operations, and each update reads current records inside its transaction so concurrent tag additions do not overwrite each other.

The database is scoped to the browser origin. This is a single-browser library, not a sync service or an encrypted vault. A JSON export is the recovery and migration path. LinkShelf does not preload example content or fetch remote titles or favicons.

## Import and export

The importer recognizes Netscape bookmark HTML, the Chrome JSON tree export, a LinkShelf version 1 JSON backup, and a simple JSON array. It validates every URL before persistence and reports duplicate and invalid record counts. Collection names from HTML folder paths are represented as a readable slash-separated name; nested folder structure is not preserved as a distinct hierarchy. Import merges into the existing shelf and skips normalized duplicates.

JSON is the loss-minimizing LinkShelf backup because it includes collection IDs, tags, timestamps, and normalized URLs. Netscape HTML is intended for broad browser compatibility; bookmarks are grouped by collection, while tags are retained in the Netscape `TAGS` attribute where supported.

URL validation is syntactic and policy-based. Search's `site:` operator performs a case-insensitive substring check on the parsed hostname. It is a display filter rather than a domain authorization check. LinkShelf deliberately avoids issuing HEAD or GET requests to saved sites: browser cross-origin restrictions make these checks unreliable, and opening arbitrary links in the background would disclose browsing intent.

## Interface

The app uses semantic forms, native dialogs, labeled controls, visible keyboard focus, and a responsive collection rail that becomes horizontally scrollable on narrow screens. Bulk selection is scoped to the current visible results and is cleared when search, tag, or collection filters change; rendering also prunes any selection that no longer matches. Bulk deletion has a separate confirmation dialog. No remote service, account, or server is required. The interface uses system font fallbacks and does not load third-party font or icon services.
