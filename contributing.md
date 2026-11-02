# Contributing to DeepSeek Supervisor V2

Thank you for your interest in improving DeepSeek Supervisor V2. Contributions are welcome, including bug fixes, documentation improvements, translations, accessibility improvements, and new features.

## Before you start

1. Search existing issues and pull requests before opening a new one.
2. For significant changes, open an issue first so the proposed approach can be discussed.
3. Please read the [Code of Conduct](CODE_OF_CONDUCT.md).
4. Do not include personal data, private chat content, credentials, or other sensitive information in issues, pull requests, screenshots, or test fixtures.

## Development setup

Requirements:

- Node.js 18 or newer
- Chrome or another Chromium-based browser

```bash
git clone https://github.com/Ifaz2611/Deepseek-supervisor-V2.git
cd Deepseek-supervisor-V2
npm install
npm run build
```

The build creates the unpacked extension in `dist/` plus a distributable zip and SHA-256 checksum in `releases/`. Load `dist/` from `chrome://extensions` with Developer mode enabled. After making changes, rebuild and reload the extension.

> `npm run build` fails on purpose if versions are out of sync between `package.json` and `static/manifest.json` or if `dist/` is missing a file the manifest references — fix the reported issue rather than bypassing the check.

## Making changes

- Keep changes focused and consistent with the existing Svelte, JavaScript, and Manifest V3 patterns.
- Preserve the project's local-first privacy model. Do not add telemetry or remote data collection.
- Update documentation when behavior, permissions, setup, or user-facing workflows change.
- Update translations when changing user-facing strings.
- Avoid committing generated output, dependencies, secrets, or editor-specific files.

## Pull requests

Before submitting a pull request:

- Run `npm run build`.
- Explain what changed and why.
- Include steps to reproduce and verify behavioral changes.
- Mention any permission, privacy, storage, or compatibility impact.
- Keep each pull request reviewable by limiting unrelated changes.

Pull requests may be revised before merging to address feedback, improve compatibility, or keep the project aligned with its privacy and security goals.

## Reporting bugs

Open a GitHub issue with:

- A clear title and description
- Steps to reproduce
- Expected and actual behavior
- Browser and operating system versions
- Relevant console errors or logs with sensitive information removed
- A minimal reproduction or screenshot when useful

For security vulnerabilities, follow [SECURITY.md](security.md) instead of opening a public issue.

## Versioning

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html): `MAJOR.MINOR.PATCH`.

- **MAJOR** — breaking changes (e.g. removed features, incompatible storage formats)
- **MINOR** — new functionality, backwards compatible
- **PATCH** — backwards-compatible bug fixes

The version lives in `package.json` (source of truth), `static/manifest.json`, and `package-lock.json`. **Never edit these by hand** — use:

```bash
npm run version:set -- 1.2.3     # exact version
npm run version:set -- patch     # or major / minor
npm run version:sync -- --check  # verify everything is in sync
```

## Creating a release

The zip, checksum, and GitHub Release are produced automatically — pushing a version tag is all it takes:

1. Work through the [release checklist](docs/RELEASE_CHECKLIST.md) (also available as a GitHub issue template — *New issue → Release checklist*).
2. Bump the version and update the changelog:
   ```bash
   npm run version:set -- X.Y.Z
   # add a X.Y.Z section to CHANGELOG.md
   ```
3. Build and test locally:
   ```bash
   npm run release        # → dist/ + releases/deepseek-supervisor-v2-vX.Y.Z.zip + .sha256
   ```
   Load the unzipped release in Chrome and smoke-test memory, skills, and settings before tagging.
4. Commit and tag:
   ```bash
   git commit -am "chore(release): vX.Y.Z"
   git tag vX.Y.Z && git push origin main --follow-tags
   ```
5. CI (`.github/workflows/release.yml`) then builds the extension, verifies the tag matches `package.json`, verifies all bundle files exist, and publishes a **GitHub Release** with the zip, its SHA-256 checksum, and auto-generated release notes (categorized via `.github/release.yml`). Edit the generated notes to add highlights, installation steps, and known issues.
6. Download the finished asset from the release page and re-verify the checksum before announcing.

### Testing the pipeline without publishing

- Use **workflow_dispatch** (*Actions → Release → Run workflow*) for a build-only dry run; artifacts are attached to the workflow run and no release is created.
- A test tag (e.g. `v0.0.0-test`) exercises the full publish path — remember to delete the test release and tag afterwards.

### Website distribution (GitHub Pages)

The landing page in [`docs/index.html`](docs/index.html) links to the latest release automatically. To publish it: **Settings → Pages → Deploy from a branch → main / (root: `/docs`)**. No build step is needed.

## Release automation ideas (future)

Things we may add later (tracked in `todo.md`):

- Automated version-bump pull requests (e.g. via a scheduled workflow)
- Auto-generating CHANGELOG entries from commit history (Conventional Commits + `git-cliff` or similar)
- Automated smoke tests run before a release is published
- Publishing to browser stores (Chrome Web Store, Edge Add-ons) once the project is stable — the release zip is already store-ready (`manifest.json` at zip root)

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
