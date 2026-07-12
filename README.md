# 🧠 DeepSeek Supervisor

<div align="center">

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome&logoColor=white)
![Manifest](https://img.shields.io/badge/Manifest-V3-green)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![License](https://img.shields.io/badge/License-Apache-green)
![Privacy](https://img.shields.io/badge/Privacy-100%25_Local-brightgreen)

**A lightweight Chrome extension that adds persistent memory and a custom skill system to DeepSeek.**  
All data stays local, private, and entirely on your device.

[Features](#-features) •
[Installation](#-installation) •
[How It Works](#-how-it-works) •
[Privacy](#-privacy--security) •
[Development](#-development)

</div>

---

> **Disclaimer:** DeepSeek Memory is an unofficial, independent, and community-driven open-source extension. It is **NOT** affiliated with, endorsed by, sponsored by, or officially connected to DeepSeek or DeepSeek AI in any way.

---

## Features

### Persistent Memory
DeepSeek naturally forgets everything between sessions. This extension fixes that. It lets the AI store and recall facts about you across conversations — your name, preferences, projects, language, and anything else you share.

- **Auto-save**: Important facts are extracted from conversations and saved automatically.
- **Language-agnostic**: Works seamlessly with English, Chinese, Turkish, and more.
- **Full control**: View, edit, delete, export, and import your memories from the settings panel.
- **Seamless injection**: Memories are automatically injected into every new chat so DeepSeek always remembers who you are.

### Skill System
Upload markdown files that define custom instructions, behaviors, or workflows to supercharge your prompts.

- **Markdown-based**: Upload `.md` files as custom skills.
- **Toggleable**: Enable or disable individual skills with a single click.
- **Always active**: Enabled skills are injected into DeepSeek with every request.

### Native Settings Panel
A clean, native-feeling settings modal integrated directly into DeepSeek's own settings dropdown.

- **General**: Toggle persistent memory on/off, sync language settings.
- **Skills**: Manage and upload your custom markdown skills.
- **Memory**: Browse, search, edit, and delete stored memories.

---

## Installation

### From Source (Developer Mode)

**Prerequisites**: Node.js 18+, npm

```bash
# 1. Clone the repository
git clone https://github.com/Ifaz2611/Deepseek-supervisor
cd Deepseek-supervisor

# 2. Install dependencies
npm install

# 3. Build the extension
npm run build
```

The `dist/` folder will contain the unpacked extension.

### Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select the generated `dist/` folder
4. Visit [chat.deepseek.com](https://chat.deepseek.com) — the extension is now active! 🎉

---

## How It Works

1. Visit [chat.deepseek.com](https://chat.deepseek.com).
2. Open DeepSeek's settings dropdown (click your profile icon).
3. Click **Memory & Skills** to open the extension panel.
4. Enable **Persistent Memory** and start chatting — DeepSeek will remember you.

**The Magic Behind the Scenes:**  
When DeepSeek identifies important information in your messages, it writes them to memory using `<Genaretion_X:memory_write>` tags. These tags are completely invisible in the chat UI — the extension intercepts and handles them silently in the background to update your local database.

---

## Privacy & Security

DeepSeek Memory is built with a **privacy-first** architecture. It does **not** collect, transmit, distribute, or sell any of your personal data, chat logs, or browsing history to any external servers or third parties.

| Feature | Implementation |
| :--- | :--- |
| **Local Storage Only** | All data (settings, memories, skills) is stored strictly on your device using `chrome.storage.local`. |
| **No External Calls** | The extension never contacts any server other than `chat.deepseek.com` (which you are already using). |
| **No Tracking** | Zero analytics, telemetry, or fingerprinting of any kind. |
| **Minimal Permissions** | Only requests `storage` (local settings) and `host_permissions` for `chat.deepseek.com`. |

> *Note: DeepSeek Memory operates entirely on `chat.deepseek.com`. Please refer to DeepSeek's own privacy policy regarding how they handle your chat data.*

---

## Development

```bash
npm run dev    # Development build with watch mode
npm run build  # Production build
```
*After making changes, rebuild and reload the extension from `chrome://extensions`.*

### Project Structure

```text
   Deepseek-SuperVisor/
   ├── |Config Files
   │   ├── package.json
   │   ├── package-lock.json
   │   ├── svelte.config.js
   │   ├── build.js
   │   └── icon.svg
   ├── |Documentation
   │   ├── README.MD
   │   ├── LICENSE
   │   ├── PROJECT_BREAKDOWN.md
   │   └── analysis_results.md
   ├── |src/ (Main Source)
   │   ├── |background/ - Extension background scripts
   │   │   └── index.js
   │   ├── |content/ - Content script injection
   │   │   ├── index.js
   │   │   ├── bridge.js
   │   │   ├── scanner.js
   │   │   ├── state.js
   │   │   ├── storage.js
   │   │   ├── |parser/ - Data parsers
   │   │   │   ├── memory-parser.js
   │   │   │   └── skill-parser.js
   │   │   └── |ui/ - Svelte UI Components
   │   │       ├── App.svelte
   │   │       ├── Drawer.svelte
   │   │       ├── MemoryImport.svelte
   │   │       ├── MemoryList.svelte
   │   │       ├── SkillList.svelte
   │   │       ├── ToastStack.svelte
   │   │       ├── SettingsPanel.svelte
   │   │       ├── SettingsIntegration.js
   │   │       └── mount.js
   │   ├── |injected/ - Injected scripts
   │   │   ├── index.js
   │   │   ├── config.js
   │   │   ├── fetch-patch.js
   │   │   ├── xhr-patch.js
   │   │   └── payload-mutator.js
   │   ├── |lib/ - Utilities
   │   │   ├── constants.js
   │   │   ├── i18n.svelte.js
   │   │   ├── indexeddb-storage.js
   │   │   └── |utils/
   │   │       └── helpers.js
   │   ├── |locales/ - i18n translations
   │   │   ├── en.json
   │   │   ├── ru.json
   │   │   ├── tr.json
   │   │   └── zh-cn.json
   │   ├── |styles/ - CSS
   │   │   └── content.css
   │   └── |platform/
   │       └── globals-chrome.js
   ├── |static/ - Static assets
   │   └── manifest.json
   └── |dist/ & node_modules/ (Build outputs)

  Key Modules:

   - background/ - Extension lifecycle & messaging
   - content/ - Page content interception & UI rendering
   - injected/ - Network request patching (fetch/XHR)
   - lib/ - Shared utilities & i18n
   - ui/ - Svelte component library

```

### Tech Stack

- **Svelte 5** (utilizing runes: `$state`, `$effect`, `$props`)
- **Vite** multi-target build system
- **Chrome Extension Manifest V3**
- **`chrome.storage.local`** for persistent local storage
- **`MutationObserver`** for DOM scanning and tag cleanup

---

**Credit** - This extension is based on the work of [Open Interpreter](https://github.com/OpenInterpreter/open-interpreter), a community-driven project that aims to make AI more accessible and transparent.

**Created by** - Ifaz_X

## License

Apache 2.0 © 2026-2027 – see [LICENSE](LICENSE) for full text.

---

<div align="center">

Made with Brain by developers who want their AI to remember them.  
**Enjoy your personalized DeepSeek experience!**

</div>