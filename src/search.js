const SEARCH_FIELDS = new Set(["tag", "collection", "site"]);

export class SearchQueryError extends Error {
  constructor(message, position) {
    super(message);
    this.name = "SearchQueryError";
    this.position = position;
  }
}

/**
 * Parse a whitespace-separated, ANDed bookmark query. A leading minus negates
 * one term. Known fields are tag:, collection:, and site:. Quoted values can
 * follow a field prefix, and escaped quotes are supported within phrases.
 */
export function parseSearchQuery(input) {
  const source = String(input ?? "");
  const clauses = [];
  let cursor = 0;

  while (cursor < source.length) {
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    if (cursor >= source.length) break;

    const termStart = cursor;
    let negated = false;
    if (source[cursor] === "-") {
      negated = true;
      cursor += 1;
      if (cursor >= source.length || /\s/.test(source[cursor]))
        throw new SearchQueryError("Add a search term after '-'.", termStart);
    }

    let field = "text";
    const prefixStart = cursor;
    const colon = source.indexOf(":", cursor);
    const whitespace = source.slice(cursor).search(/\s/);
    const boundary = whitespace < 0 ? source.length : cursor + whitespace;
    if (colon >= cursor && colon < boundary) {
      const candidate = source.slice(cursor, colon).toLocaleLowerCase();
      if (SEARCH_FIELDS.has(candidate)) {
        field = candidate;
        cursor = colon + 1;
        while (/\s/.test(source[cursor] ?? "")) cursor += 1;
        if (cursor >= source.length || /\s/.test(source[cursor]))
          throw new SearchQueryError(`Add a value after '${field}:'.`, colon + 1);
      } else if (/^[a-z][a-z\d_-]*$/i.test(candidate) && candidate !== "http" && candidate !== "https") {
        throw new SearchQueryError(`Unknown search field '${candidate}:'.`, prefixStart);
      }
    }

    let value = "";
    if (source[cursor] === '"') {
      const quoteStart = cursor;
      cursor += 1;
      let closed = false;
      while (cursor < source.length) {
        const character = source[cursor];
        if (character === "\\" && source[cursor + 1] === '"') {
          value += '"';
          cursor += 2;
        } else if (character === '"') {
          cursor += 1;
          closed = true;
          break;
        } else {
          value += character;
          cursor += 1;
        }
      }
      if (!closed)
        throw new SearchQueryError("Close the quoted search phrase.", quoteStart);
      if (cursor < source.length && !/\s/.test(source[cursor]))
        throw new SearchQueryError("Add a space after the quoted phrase.", cursor);
      if (!value.trim())
        throw new SearchQueryError("A quoted search phrase cannot be empty.", quoteStart);
    } else {
      const valueStart = cursor;
      while (cursor < source.length && !/\s/.test(source[cursor])) cursor += 1;
      value = source.slice(valueStart, cursor);
      if (!value)
        throw new SearchQueryError(
          field === "text" ? "Add a search term." : `Add a value after '${field}:'.`,
          valueStart,
        );
      if (value.includes('"'))
        throw new SearchQueryError("Put a quoted phrase in double quotes.", valueStart);
    }

    clauses.push({ field, value: value.toLocaleLowerCase(), negated });
  }

  return clauses;
}

function includesValue(values, query) {
  return values.some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
}

export function matchesSearchQuery(bookmark, collectionById, clauses) {
  return clauses.every((clause) => {
    let matches;
    if (clause.field === "tag") {
      matches = includesValue(bookmark.tags ?? [], clause.value);
    } else if (clause.field === "collection") {
      matches = includesValue(
        [collectionById.get(bookmark.collectionId)?.name ?? "Unsorted"],
        clause.value,
      );
    } else if (clause.field === "site") {
      matches = includesValue([new URL(bookmark.url).hostname], clause.value);
    } else {
      matches = includesValue(
        [bookmark.title, bookmark.url, ...(bookmark.tags ?? [])],
        clause.value,
      );
    }
    return clause.negated ? !matches : matches;
  });
}
