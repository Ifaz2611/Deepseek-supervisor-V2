# DeepSeek Supervisor V2

<div align="center">

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome&logoColor=white)
![Manifest](https://img.shields.io/badge/Manifest-V3-green)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![License](https://img.shields.io/badge/License-Apache_2.0-green)
![Privacy](https://img.shields.io/badge/Privacy-100%25_Local-brightgreen)

**Persistent memory + custom skills for [chat.deepseek.com](https://chat.deepseek.com) — all data stays on your device.**

[Features](#features) • [Installation](#installation) • [How It Works](#how-it-works) • [Usage](#usage) • [Privacy](#privacy--security) • [Development](#development) • [Troubleshooting](#troubleshooting)

</div>

> **Disclaimer:** This is an unofficial community extension. Not affiliated with, endorsed by, or connected to DeepSeek / DeepSeek AI.

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

## Installation

### Prerequisites
Node.js 18+ and Chrome / Chromium (Edge, Brave, etc.)

```bash
git clone https://github.com/Ifaz2611/Deepseek-supervisor-V2
cd Deepseek-supervisor-V2
npm install
npm run build
```

`dist/` is the unpacked extension.

### Load in Chrome
1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select `dist/`
3. Open [chat.deepseek.com](https://chat.deepseek.com) — extension auto-activates

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

## Development

```bash
npm run dev    # same as build (watches via Vite)
npm run build  # production (3 bundles: content, background, injected + manifest + icons)
```

After changes, reload the extension in `chrome://extensions`.

### Project Structure
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

## Known Fixes in This Release (v1.0.1)

- `MemoryList.svelte:2` — added missing `import { pushConfigToPage } from "../bridge.js"` (ReferenceError on delete/save/import)
- `scanner.js:14-15,60,80` — `TAG_REGEX` now allows attributes, `INJECTED_BLOCK_REGEX` covers `memory_write`, observer synced to `state.observer`, DOM writes wrapped in `withObserverPaused` to avoid loops
- `indexeddb-storage.js:239` — `saveMemoriesBatch` is now sequential (no concurrent `get`/`put` race inside one transaction)
- `storage.js:25` — `checkIDBAvailability` no longer double-resolves (clearTimeout on success/error)
- `constants.js:5` — added `pendingMemoryImport` key
- `content/index.js:10,34,52` — handles `bds_pending_memory_import` (auto-fills DeepSeek input after cross-AI import)
- `MemoryList.svelte:44` — import now **merges** instead of replacing all memories
- `build.js:102` — icon generation no longer fails the whole build if `sharp` errors
- `svelte.config.js:3` — removed `css: "injected"` to let Vite extract `content.css` cleanly

---

**Credit:** Inspired by community work around DeepSeek Memory. Built by Ifaz_X.

**License:** Apache 2.0 — see [LICENSE](LICENSE).

<div align="center">

Made with care for people who want their AI to remember them.

</div>
