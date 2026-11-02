# DeepSeek Supervisor V2

<div align="center">

[![Latest Release](https://img.shields.io/github/v/release/Ifaz2611/Deepseek-supervisor-V2?label=Release&logo=github)](https://github.com/Ifaz2611/Deepseek-supervisor-V2/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Ifaz2611/Deepseek-supervisor-V2/total?label=Downloads&logo=googlechrome&logoColor=white)](https://github.com/Ifaz2611/Deepseek-supervisor-V2/releases/latest)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome&logoColor=white)
![Manifest](https://img.shields.io/badge/Manifest-V3-green)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![License](https://img.shields.io/badge/License-Apache_2.0-green)
![Privacy](https://img.shields.io/badge/Privacy-100%25_Local-brightgreen)

**Persistent memory + custom skills for [chat.deepseek.com](https://chat.deepseek.com) — all data stays on your device.**

[Download](#-download--install) • [Features](#features) • [How It Works](#how-it-works) • [Usage](#usage) • [Privacy](#privacy--security) • [For Developers](#for-developers) • [Troubleshooting](#troubleshooting)

</div>

> **Disclaimer:** This is an unofficial community extension. Not affiliated with, endorsed by, or connected to DeepSeek / DeepSeek AI.

---

## 📥 Download & Install

No build tools needed — install the pre-built extension in under two minutes. Full guide: **[INSTALL.md](INSTALL.md)**.

1. **Download** — grab `deepseek-supervisor-v2-vX.Y.Z.zip` from the **[Latest Release](https://github.com/Ifaz2611/Deepseek-supervisor-V2/releases/latest)** page.
2. **Verify (optional but recommended)** — check the SHA-256 checksum against the `.sha256` file in the same release ([how](INSTALL.md#verifying-the-download-checksums)).
3. **Extract** the zip to a permanent folder.
4. **Load it:**
   - Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`)
   - Enable **Developer mode**
   - Click **Load unpacked** and select the extracted folder
5. Open [chat.deepseek.com](https://chat.deepseek.com) — a **Memory & Skills** entry appears in DeepSeek's own menu.

> 📜 What's new: [CHANGELOG.md](CHANGELOG.md) • 🛡 Checksums & security notes: [INSTALL.md](INSTALL.md) • 🌐 Landing page: https://ifaz2611.github.io/Deepseek-supervisor-V2/


---

## Features

### Persistent Memory
DeepSeek forgets between sessions — this fixes it. Facts you share (name, language, profession, projects, preferences) are extracted from the assistant's `<BDS:memory_write>` tags, saved locally, and injected into every future conversation.

- Auto-extract via `MutationObserver` + periodic scan, with blacklist filtering to block placeholders
- Importance levels: `always` (identity) and `called` (context)
- View / search / edit / delete / export / import (JSON) from the settings panel
- Block scrubbing so you never see raw `<dsmemory>` tags

### Skill System
Markdown files as custom instructions/workflows.

- Upload `.md` or `.json` (bulk) or fetch from any URL (GitHub blob → raw, repo root → `README.md`)
- Toggle per-skill on/off, fingerprint-based injection (only when changed or on first message)
- Injected as `<BDS:SKILLS>` block

### Native Settings Panel
Injected into DeepSeek's own dropdown (`Memory & Skills` entry next to "Get App").

- **General:** toggle persistent memory, sync locale with browser, manual language select
- **Skills:** upload / fetch / toggle / edit / delete
- **Memory:** browse, edit, delete, export, import + cross-AI import (paste another AI's export)

---

## For Developers

### Local setup

Prerequisites: Node.js 18+ and Chrome / Chromium (Edge, Brave, etc.)

```bash
git clone https://github.com/Ifaz2611/Deepseek-supervisor-V2
cd Deepseek-supervisor-V2
npm install
npm run release    # build + package + SHA-256 checksum
```

`dist/` is the unpacked extension — load it via `chrome://extensions` → Developer mode → **Load unpacked**. After changes, rebuild and reload the extension.

### Scripts

```bash
npm run dev                    # build (same as build)
npm run build                  # production build → dist/ + releases/*.zip
npm run build -- --no-package  # build only, skip the zip step
npm run package                # re-package existing dist/ → releases/
npm run release                # full release: build + package + checksum
npm run version:set -- 1.2.3   # set version (package.json, lockfile, manifest)
npm run version:sync -- --check  # verify manifest ↔ package.json versions match
```

Every build self-checks: versions must match across `package.json`/`static/manifest.json`, and every file the manifest references must exist in `dist/` before the zip is created. Zips are **reproducible** — same source + version ⇒ identical SHA-256.

### Releasing a new version

Follow [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) (also available as a GitHub issue template). In short: `npm run version:set -- X.Y.Z` → update [CHANGELOG.md](CHANGELOG.md) → `npm run release` → test in Chrome → commit, `git tag vX.Y.Z && git push origin main --follow-tags` → GitHub Actions publishes the Release with the zip + checksum automatically. Details in [contributing.md](contributing.md).


---

## How It Works

### Two-world bridge
Content scripts are isolated, so network patching must run in the page's MAIN world.

```
content (ISOLATED)  --dsm:cu (config)-->  injected (MAIN)  --fetch/XHR patch-->  DeepSeek API
                                    <--dsm:rq (request config)--
```

1. `content/bridge.js` injects `injected.js` via `<script src=chrome.runtime.getURL("injected.js")>`
2. `injected/index.js` patches `fetch` and `XMLHttpRequest`, intercepts `/api/v0/chat/completion`, `/api/v0/chat/edit_message`, `/api/v0/chat_session/fetch_page`
3. `payload-mutator.js` builds a hidden prefix: `MEMORY_SYSTEM` (every turn) + `BDS:SKILLS` (first turn / on change) + `BDS:memory_calls` (all memories, `always` first), and cleans history via `stripBlocksFromJsonValue`

### Memory extraction & scrubbing
`content/scanner.js` observes `document.body` mutations, extracts `<BDS:memory_write>` inside `<dsmemory>`, validates against a blacklist, saves via `IndexedDB` (primary) / `chrome.storage.local` (fallback), and strips injected blocks from the DOM (`withObserverPaused` prevents self-triggered loops). A transient inline toast confirms saves.

### Storage
- `IndexedDB` (`DeepSeekMemoryDB`, stores: `memories`, `settings`, `skills`, `metadata`) — transactional, versioned
- `chrome.storage.local` — fallback + always for `bds_settings`, `bds_skills`, locale updates
- Automatic migration on first run

---

## Usage

1. Open DeepSeek → click profile/settings dropdown → **Memory & Skills**
2. Enable **Persistent Memory**
3. Chat normally — the model will emit `<BDS:memory_write key="..." importance="...">` inside `<dsmemory>`; tags are scrubbed before you see them
4. Manage memories/skills in the drawer; import from ChatGPT/Claude/Gemini via `MemoryImport` (copies a prompt, pastes the other AI's reply, stores as `bds_pending_memory_import` and auto-fills on next DeepSeek load)

---

## Privacy & Security

| Area | Detail |
|------|--------|
| **Storage** | Only `chrome.storage.local` + `IndexedDB` on device |
| **Network** | No telemetry; only `chat.deepseek.com` + optional `raw.githubusercontent.com` fetches proxied via background SW (`BDS_FETCH_SKILL_URL`) to avoid CORS |
| **Permissions** | `storage` + `host_permissions: https://chat.deepseek.com/*` |
| **Scrubbing** | Tags stripped from DOM and from `fetch_page` XHR/fetch responses before React renders |

---

## Project Structure

```
src/
  background/index.js        # SW: locale update + BDS_FETCH_SKILL_URL proxy
  content/
    index.js                 # bootstrap, handles pendingMemoryImport
    state.js                 # shared state + withObserverPaused
    storage.js               # IDB ↔ chrome.storage + normalization
    bridge.js                # dsm:cu / dsm:rq events, injectHookScript
    scanner.js               # MutationObserver extraction & scrubbing
    parser/{memory,skill}-parser.js
    ui/{App,Drawer,SettingsPanel,SkillList,MemoryList,MemoryImport,SettingsIntegration,mount}.js|svelte
  injected/
    index.js, config.js, payload-mutator.js, fetch-patch.js, xhr-patch.js
  lib/{constants,i18n.svelte,indexeddb-storage,utils/helpers}.js
  locales/*.json, styles/content.css, platform/globals-chrome.js
static/manifest.json
build.js, svelte.config.js, icon.svg
scripts/                     # packaging & release tooling (zero-dependency zip, checksums, version sync)
docs/                        # release checklist + GitHub Pages landing page (index.html)
.github/workflows/release.yml  # CI: build → verify → publish GitHub Release on v* tags
```

### Tech Stack
Svelte 5 (runes `$state`/`$derived`/`$effect`/`$props`), Vite 6, Manifest V3, IndexedDB

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `pushConfigToPage is not defined` in console | Fixed in v1.0.1 — ensure `src/content/ui/MemoryList.svelte:2` imports it |
| Memories not saving | Check console for IDB errors; disabling IDB falls back to `chrome.storage.local`. Export memories before clearing site data |
| Injected tags visible | Scanner CSS fallback + JS scrubbing — reload page; if persistent, open an issue with a DOM snapshot |
| Skills not injecting | Verify skill is **active** (checkbox) and has content; fingerprint changes trigger re-injection on next message |
| Language not switching | Toggle off **Sync extension language with browser** then pick manually |

---

## Fixed in v1.0.1

This release fixes the crashes and injection bugs listed in the [v1.0.1 changelog entry](CHANGELOG.md#101---2026-11-02) — highlights: missing `pushConfigToPage` import, memory-import merging, scanner regex/observer fixes, and clean `content.css` extraction. All fixes are included in the current release download.

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

**Credit:** Inspired by community work around DeepSeek Memory. Built by Ifaz_X.

**License:** Apache 2.0 — see [LICENSE](LICENSE).

<div align="center">

Made with care for people who want their AI to remember them.

</div>
