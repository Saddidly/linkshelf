# Verification

Local evidence recorded on 2026-10-03.

## Passed

9 tests and a Vite production build passed. Tests cover URL rules, JSON/HTML transfer, persistence, uniqueness, collection rehoming, and concurrent mutations across repository instances. Chromium browser acceptance saved a synthetic bookmark, reloaded it, searched it, and inspected the 390px layout. No page errors were reported.

## Environment and limits

Windows Node.js 22.14.0 and Chromium. Browser tests used a clean automation profile and synthetic data. Safari/Firefox, private-mode storage, and device-level accessibility have not been exercised.

## Hosted evidence

[GitHub Actions run](https://github.com/Saddidly/linkshelf/actions/runs/37111957823) passed on 2026-10-03 for code revision `fa0f30fa6b2e6c0d8245bebf0b459a12f250a7a9`.

Ubuntu, Node 22; unit tests, production build, and Chromium desktop/mobile flows covering persistence, validation, search, export, and duplicate import.

These checks cover the named environments and cases, not every possible input or platform. Re-run README commands after changing dependencies or moving to another platform. Screenshots and acceptance data are synthetic.

