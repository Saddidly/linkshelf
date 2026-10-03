# Verification

## Local evidence for 1.1.0

Verified locally on 2026-10-03 with Node.js 22.14.0, npm 10.9.2, and installed Google Chrome on Windows. `npm ci` completed and reported no vulnerabilities. The unit suite passed 16 tests across URL policy, transfer formats, search parsing and evaluation, IndexedDB batch rollback, and concurrent mutations. The Vite production build passed.

All four Playwright cases passed across desktop and 390px mobile Chromium for bookmark persistence, advanced mixed search, visible-only selection, keyboard focus after selection, moving/tagging/deleting batches, invalid batch input with no partial change, canceling deletion, and persistence after reload. The browser flow also confirmed no horizontal page overflow at the tested mobile viewport and no page errors. Browser data was synthetic and isolated.

A separate manual Chrome check used a local preview on port 4287, on an origin separate from Playwright. With two synthetic bookmarks it exercised compound tag/site/negation search, visible selection, bulk move and tag addition, quoted collection and tag searches, canceling bulk deletion, reload persistence, and invalid-query feedback. The visible browser check reported no console warnings or errors.

Run the checks with:

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

## Environment and limits

The local browser checks cover installed Chrome at desktop and 390px mobile viewports. Safari, Firefox, private-mode storage, and device-level assistive technology were not exercised. These checks cover the named environments and cases, not every input or platform.

## Hosted CI

The [GitHub Actions workflow](https://github.com/Saddidly/linkshelf/actions/workflows/ci.yml) publishes a result for each revision. The link is live; this document makes no hosted pass claim for the pending 1.1.0 revision.

## Historical hosted evidence

The [GitHub Actions run](https://github.com/Saddidly/linkshelf/actions/runs/37111957823) passed on 2026-10-03 for the earlier revision `fa0f30fa6b2e6c0d8245bebf0b459a12f250a7a9`. That result predates version 1.1.0 and does not verify the search and bulk changes in this release.
