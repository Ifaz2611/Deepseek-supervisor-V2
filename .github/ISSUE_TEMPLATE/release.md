---
name: "Release checklist"
about: "Track a new extension release (vX.Y.Z)"
title: "Release vX.Y.Z"
labels:
  - release
---

Follow [docs/RELEASE_CHECKLIST.md](../blob/main/docs/RELEASE_CHECKLIST.md) for details. Replace `X.Y.Z` with the release version.

## Prepare the version

- [ ] Version follows Semantic Versioning; bumped via `npm run version:set -- X.Y.Z`
- [ ] `npm run version:sync -- --check` passes
- [ ] CHANGELOG.md has a `X.Y.Z` section; README references updated

## Build & test locally

- [ ] `npm ci && npm run release` succeed
- [ ] Smoke-tested in Chrome on chat.deepseek.com (memory, skills, settings, language)
- [ ] Release zip extracted and loaded from the extracted folder
- [ ] Checksum verified (`sha256sum -c` / `Get-FileHash`)

## Commit & tag

- [ ] `git commit -am "chore(release): vX.Y.Z"`
- [ ] `git tag vX.Y.Z && git push origin main --follow-tags`

## Verify the automated release

- [ ] Release workflow run is green
- [ ] GitHub Release `vX.Y.Z` has zip + `.sha256` + edited release notes
- [ ] Downloaded asset verifies and installs in a clean profile

## After the release

- [ ] Issue closed; test releases cleaned up
