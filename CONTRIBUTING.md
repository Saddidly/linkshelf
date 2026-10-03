# Contributing

Thanks for taking a look at LinkShelf. Keep changes focused and preserve the app's local-first behavior.

## Before opening a change

1. Install dependencies with `npm install`.
2. Run `npm test` and `npm run build`.
3. Add or update tests when changing URL policy, import formats, duplicate handling, exports, or persistence.
4. For UI changes, check keyboard focus, dialog use, empty states, and a narrow viewport.

Use small modules and keep validation in the domain or transfer layer rather than relying on UI checks alone. Do not add analytics, remote bookmark fetching, or network persistence without first documenting the privacy and data model impact.

## Pull requests

Describe the user-visible behavior, include the checks you ran, and mention any browser-specific limitations. Do not include personal bookmark exports or browser profile data in issues or fixtures.
