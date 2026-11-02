# Installing DeepSeek Supervisor V2

A step-by-step guide for installing the extension from pre-built release zips — no Node.js or programming knowledge required.

- **Works with:** Chrome, Edge, Brave, Opera, Vivaldi, and any Chromium-based browser that supports Manifest V3
- **Does not work with:** Firefox (the extension uses a Chromium-only main-world bridge)
- **Requirements:** none beyond the browser itself

---

## Option A — Install from a release (recommended for everyone)

### 1. Download the latest zip

1. Go to the **[Latest Release](https://github.com/Ifaz2611/Deepseek-supervisor-V2/releases/latest)** page.
2. Under **Assets**, download:
   - `deepseek-supervisor-v2-vX.Y.Z.zip` — the extension itself
   - *(optional, recommended)* `deepseek-supervisor-v2-vX.Y.Z.zip.sha256` — checksum for verification

### 2. (Recommended) Verify the download

See [Verifying the download](#verifying-the-download-checksums) below.

### 3. Unpack the zip

The zip is **Chrome Web Store style**: `manifest.json` sits at the root of the archive.

- **Windows:** right-click the zip → **Extract All…** (creates a folder named after the zip)
- **macOS:** double-click the zip
- **Linux:** `unzip deepseek-supervisor-v2-vX.Y.Z.zip -d deepseek-supervisor`

> ⚠️ Load the **extracted folder**, not the zip itself. If you move or delete the folder later, the extension stops loading — keep it in a permanent location such as `Documents/extensions/`.

### 4. Load the extension in your browser

**Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked** and select the extracted folder
4. (Optional) Pin the extension via the puzzle-piece menu

**Edge**

1. Open `edge://extensions`
2. Enable **Developer mode** (left sidebar)
3. Click **Load unpacked** and select the extracted folder

**Brave / Vivaldi / Opera**

Same as Chrome with `brave://extensions` / `vivaldi://extensions` / `opera://extensions`.

### 5. Confirm the extension works

1. Open [chat.deepseek.com](https://chat.deepseek.com) (log in if needed)
2. Open DeepSeek's own menu — you should see a **Memory & Skills** entry that opens this extension's settings panel
3. In the panel's **Memory** tab, add a memory such as *“My name is …”* and send a message — the fact is now injected into every conversation

---

## Updating to a newer version

1. **Export your memories first** (Settings panel → Memory → Export). Removing an extension in Chrome deletes its locally stored data.
2. Download + verify + extract the new release zip (steps above).
3. On `chrome://extensions`, click **Remove** on the old version, then **Load unpacked** for the new folder.
4. Import your memories back (Settings panel → Memory → Import) if you had removed the old version.

If the folder path stays the same and you only replace its contents, a simple **reload** icon click on `chrome://extensions` is enough.

---

## Verifying the download (checksums)

Every release ships a `.sha256` file containing the SHA-256 hash of the zip in the standard `<hash>  <filename>` format. Verifying proves the file you downloaded was not corrupted or tampered with in transit.

The published checksum always corresponds to the asset in the **same release**, and was produced by the CI build from that exact commit (the build is deterministic — rebuilding from the tagged source yields the identical hash).

**Windows (PowerShell):**

```powershell
# in the folder containing the downloaded zip + .sha256 file
$expected = (Get-Content 'deepseek-supervisor-v2-v1.0.1.zip.sha256').Split(' ')[0]
$actual   = (Get-FileHash 'deepseek-supervisor-v2-v1.0.1.zip' -Algorithm SHA256).Hash.ToLower()
if ($expected -eq $actual) { "OK" } else { "MISMATCH — do not install" }
```

**macOS / Linux:**

```bash
cd path/to/downloads
sha256sum -c deepseek-supervisor-v2-v1.0.1.zip.sha256    # → deepseek-supervisor-v2-v1.0.1.zip: OK
# macOS: shasum -a 256 -c deepseek-supervisor-v2-v1.0.1.zip.sha256
```

A mismatch usually means an interrupted download — re-download the zip. If it still mismatches, please [open an issue](https://github.com/Ifaz2611/Deepseek-supervisor-V2/issues).

**Security-conscious users** can additionally build the extension from source (see [Option B](#option-b--build-from-source-developers)) — the build is deterministic, so a self-built zip has the exact same checksum as the release asset for the same version tag.

---

## Option B — Build from source (developers)

```bash
git clone https://github.com/Ifaz2611/Deepseek-supervisor-V2.git
cd Deepseek-supervisor-V2
npm install
npm run release     # → dist/ + releases/deepseek-supervisor-v2-vX.Y.Z.zip + .sha256
```

Then follow step 4 above using the `dist/` folder (or the freshly built zip). See [contributing.md](contributing.md) for the full developer workflow.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **Load unpacked** button missing | Enable **Developer mode** on the extensions page first |
| “Manifest file is missing or unreadable” | You selected the zip file or its parent folder — select the folder that *directly contains* `manifest.json` |
| “Corrupted” / fails to extract | Re-download the zip and [verify the checksum](#verifying-the-download-checksums) |
| Extension loads but nothing appears on chat.deepseek.com | Reload the tab (Ctrl/Cmd+Shift+R); check the extension is enabled on the extensions page; verify you are on `chat.deepseek.com` |
| Console error about CSP / injected script | Hard-refresh the page; the injected script is injected on page load, so the extension must be enabled *before* opening DeepSeek |
| Build fails on `npm install` | Check Node.js ≥ 18 (`node --version`); delete `node_modules/` and reinstall |
| Wrong UI language | Settings panel → General → disable *Sync extension language with browser*, pick a language manually |

Still stuck? [Open an issue](https://github.com/Ifaz2611/Deepseek-supervisor-V2/issues) with your browser version, OS, and any console errors (remove personal data first).
