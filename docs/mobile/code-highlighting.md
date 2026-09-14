# Shared code highlighting

Web and Android use the same installed Shiki version, Oniguruma engine, full language catalog (loaded on demand) and theme catalog. `lib/code/themes.ts` owns legacy theme mappings; `lib/visualization/theme-catalog.ts` owns the selectable themes. A fixed Shiki theme keeps its colors in either UI mode, while legacy paired themes follow the configured code color mode.

After changing Shiki or the catalog, run `npm run mobile:highlight` from the repository root (Node dependencies and Flutter/Dart must be installed). Commit the generated runtime, grammar/theme assets and Dart metadata together. The generator rejects missing theme mappings. Mobile loads individual bundled grammar/theme files on demand without network access, renders returned tokens with native Flutter text, and releases the idle runtime after 30 seconds. Token caches are limited to 32 entries and 256 Ki characters of source.

Validation:

- `npm test` compares the offline runtime's exact tokens, styles and surfaces to Web Shiki using `contracts/highlight-fixtures.json`.
- `cd mobile && flutter test` verifies cache isolation, eviction and retry behavior.
- `cd mobile && flutter test integration_test/code_highlighter_test.dart -d <android-device>` verifies the actual WebView/WASM bridge on Android.

For chat rendering checks, run `node mobile/tool/web-reference.mjs` and open `/qa-session?performance=1` on port 4317. This isolated fixture uses 100 messages and a button that streams 20 updates. Only the QA bundle instruments render counters, exposed as `data-qa-chat-renders` and `data-qa-message-renders` on the document element. Typing should not increase either counter; streaming should leave the first 99 message counters unchanged. No live API is called.
