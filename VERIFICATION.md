# Verification

Local evidence recorded on 2026-10-03.

## Passed

9 tests and a Vite production build passed. Tests cover URL rules, JSON/HTML transfer, persistence, uniqueness, collection rehoming, and concurrent mutations across repository instances. Chromium browser acceptance saved a synthetic bookmark, reloaded it, searched it, and inspected the 390px layout. No page errors were reported.

## Environment and limits

Windows Node.js 22.14.0 and Chromium. Browser tests used a clean automation profile and synthetic data. Safari/Firefox, private-mode storage, and device-level accessibility have not been exercised.

The checked-in CI workflow is ready to run when published. It is configuration,
not evidence of a hosted pass. Re-run README commands after changing dependencies
or moving to another platform. Screenshots, where included, use synthetic data.
