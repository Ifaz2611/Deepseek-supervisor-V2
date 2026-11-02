# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each version heading links to its GitHub release page.

## [Unreleased]

Nothing yet. Add entries under the Keep a Changelog categories (Added / Changed / Deprecated / Removed / Fixed / Security) and move them into a version heading when it is released.

## [1.0.1] - 2026-11-02

Bug-fix release — details in the [v1.0.1 release notes](https://github.com/Ifaz2611/Deepseek-supervisor-V2/releases/tag/v1.0.1).

### Fixed

- `MemoryList.svelte` — added missing `pushConfigToPage` import from `../bridge.js` (ReferenceError on delete/save/import)
- `scanner.js` — `TAG_REGEX` now allows attributes; `INJECTED_BLOCK_REGEX` covers `memory_write`; observer synced to `state.observer`; DOM writes wrapped in `withObserverPaused` to avoid observer loops
- `indexeddb-storage.js` — `saveMemoriesBatch` is now sequential (no concurrent `get`/`put` race inside one transaction)
- `storage.js` — `checkIDBAvailability` no longer double-resolves (`clearTimeout` on success/error)
- `constants.js` — added `pendingMemoryImport` key
- `content/index.js` — handles `bds_pending_memory_import` (auto-fills DeepSeek input after cross-AI import)
- `MemoryList.svelte` — memory import now **merges** instead of replacing all memories
- `build.js` — icon generation no longer fails the whole build if `sharp` errors
- `svelte.config.js` — removed `css: "injected"` so Vite extracts `content.css` cleanly

### Added

- Distribution tooling: `npm run package` / `npm run release` build a reproducible, versioned zip + SHA-256 checksum into `releases/`
- GitHub Actions release workflow (`.github/workflows/release.yml`) — pushes of `vX.Y.Z` tags publish a GitHub Release automatically
- `INSTALL.md` install & verification guide, `docs/RELEASE_CHECKLIST.md`, release issue template
- GitHub Pages landing page (`docs/index.html`) linking to the latest release

## [1.0.0] - Initial release

Initial public release — details in the [v1.0.0 release page](https://github.com/Ifaz2611/Deepseek-supervisor-V2/releases/tag/v1.0.0).

### Added

- **Persistent memory** — facts extracted from assistant `<BDS:memory_write>` blocks are saved locally (IndexedDB, with `chrome.storage.local` fallback) and injected into every future conversation; `always` and `called` importance levels; search / edit / delete / export / import
- **Skill system** — markdown files as custom instructions/workflows; upload `.md`/`.json`, fetch from URL; per-skill toggles; fingerprint-based injection as a `<BDS:SKILLS>` block
- **Native settings panel** injected into DeepSeek's own dropdown (*Memory & Skills* next to "Get App")
- **Cross-AI import** — paste another AI assistant's memory export
- **Request pipeline** — MAIN-world `fetch`/`XHR` patching with hidden memory/skill prefix assembly and history scrubbing
- **Privacy** — 100% local processing, no telemetry, permissions limited to `storage` + `chat.deepseek.com`
- **i18n** — English, Russian, Turkish, Simplified Chinese

[Unreleased]: https://github.com/Ifaz2611/Deepseek-supervisor-V2/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/Ifaz2611/Deepseek-supervisor-V2/releases/tag/v1.0.1
[1.0.0]: https://github.com/Ifaz2611/Deepseek-supervisor-V2/releases/tag/v1.0.0
