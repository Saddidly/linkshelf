const TRACKING_PARAMETERS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);

export function validateUrl(input) {
  const value = String(input ?? "").trim();
  if (!value) return { valid: false, message: "Enter a web address." };
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(value)
    ? value
    : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol))
      return {
        valid: false,
        message: "Only HTTP and HTTPS links can be saved.",
      };
    if (!url.hostname || url.username || url.password)
      return {
        valid: false,
        message: "Enter a valid web address without a username or password.",
      };
    return { valid: true, url: url.href };
  } catch {
    return {
      valid: false,
      message: "Enter a valid web address, such as https://example.com.",
    };
  }
}

export function normalizeUrl(input) {
  const validation = validateUrl(input);
  if (!validation.valid) throw new TypeError(validation.message);
  const url = new URL(validation.url);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (
      key.toLowerCase().startsWith("utm_") ||
      TRACKING_PARAMETERS.has(key.toLowerCase())
    )
      url.searchParams.delete(key);
  }
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}

export function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `ls-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

export function cleanTags(value) {
  const tags = Array.isArray(value) ? value : String(value ?? "").split(",");
  const unique = new Map();
  for (const raw of tags) {
    const tag = String(raw).trim().replace(/\s+/g, " ").slice(0, 32);
    if (tag && !unique.has(tag.toLowerCase()))
      unique.set(tag.toLowerCase(), tag);
  }
  return [...unique.values()].slice(0, 20);
}

export function collectionLabel(path) {
  if (Array.isArray(path)) return path.filter(Boolean).join(" / ");
  return String(path ?? "").trim();
}
