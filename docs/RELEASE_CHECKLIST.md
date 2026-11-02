# Release Checklist

Use this template for **every release**. The easiest way: create a GitHub issue with the built-in **Release checklist** template (`.github/ISSUE_TEMPLATE/release.md`) and tick items there.

Replace `X.Y.Z` with the version you are releasing.

---

## 1. Prepare the version

- [ ] Decide the version following **Semantic Versioning** (MAJOR.MINOR.PATCH — see *Versioning* in [contributing.md](../contributing.md))
- [ ] Bump the version in one command: `npm run version:set -- X.Y.Z` (updates `package.json`, `package-lock.json`, and `static/manifest.json`)
- [ ] Confirm they are in sync: `npm run version:sync -- --check`
- [ ] Add a `X.Y.Z` section to [CHANGELOG.md](../CHANGELOG.md) (move items from *Unreleased*)
- [ ] Update version references in [README.md](../README.md) (screenshots, "Known Fixes" heading, etc.) if they mention a version

## 2. Build & test locally

- [ ] Clean install: `rm -rf node_modules && npm ci` (or delete `node_modules/` on Windows)
- [ ] Full release build: `npm run release`
  - produces `dist/`, `releases/deepseek-supervisor-v2-vX.Y.Z.zip` and the `.sha256` checksum
- [ ] Load `dist/` in Chrome (`chrome://extensions` → Developer mode → **Load unpacked**) and smoke-test:
  - [ ] Extension activates on [chat.deepseek.com](https://chat.deepseek.com) (Memory & Skills entry present)
  - [ ] Memory extraction + injection works (add a memory, send a message)
  - [ ] Skills upload / toggle / injection works
  - [ ] Settings panel tabs render; export/import works
  - [ ] Language switch works
- [ ] Extract the release zip and load **the extracted folder** (not `dist/`) — verifies the shipped artifact itself
- [ ] Verify the checksum: `sha256sum -c releases/deepseek-supervisor-v2-vX.Y.Z.zip.sha256` (PowerShell: see [INSTALL.md](../INSTALL.md))

## 3. Commit & tag

- [ ] Commit the version bump + changelog: `git commit -am "chore(release): vX.Y.Z"`
- [ ] Tag it: `git tag vX.Y.Z`
- [ ] Push: `git push origin main --follow-tags`

## 4. Verify the automated release

- [ ] The [Release workflow](https://github.com/Ifaz2611/Deepseek-supervisor-V2/actions/workflows/release.yml) run for the tag is **green** (builds, verifies bundle contents, publishes)
- [ ] GitHub Release `vX.Y.Z` exists with:
  - [ ] `deepseek-supervisor-v2-vX.Y.Z.zip`
  - [ ] `deepseek-supervisor-v2-vX.Y.Z.zip.sha256`
  - [ ] Auto-generated release notes (edit them to add highlights — what's new, installation steps, known issues)
- [ ] Download the release zip from GitHub, verify its checksum, install it in a clean profile and confirm it works

## 5. After the release

- [ ] Close the release issue and any milestone
- [ ] Remove any `*-test` / dry-run releases from GitHub Releases
- [ ] Announce (Discussions/README badge updates automatically)

---

### Dry-run / pipeline testing without publishing

Use **workflow_dispatch** (Actions → Release → *Run workflow*) to test the full CI build without creating a release — the zip is attached to the workflow run instead of a GitHub Release.
