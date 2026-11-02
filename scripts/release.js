/**
 * One-command release build:
 *
 *   npm run release
 *
 * Steps:
 *   1. Sync the version (package.json → static/manifest.json)
 *   2. Run the full build (all bundles + manifest + icons)
 *   3. Package dist/ into releases/deepseek-supervisor-v2-v<version>.zip
 *   4. Generate a SHA-256 checksum file next to the zip
 *
 * Flags:
 *   --skip-build  reuse the existing dist/ (only re-package + checksum)
 */

import { spawnSync } from "child_process";
import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { resolve, basename, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { ROOT, syncManifestVersion } from "./sync-version.js";
import { packageDist, RELEASES_DIR } from "./package.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = "https://github.com/Ifaz2611/Deepseek-supervisor-V2";

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function main() {
  const skipBuild = process.argv.includes("--skip-build");

  // 1. Version sync -----------------------------------------------------------
  const sync = syncManifestVersion();
  const version = sync.version;
  console.log(
    sync.changed
      ? `▶ version: ${sync.from} → ${version} (synced into static/manifest.json)`
      : `▶ version: ${version} (already in sync)`
  );

  // 2. Build -------------------------------------------------------------------
  if (!skipBuild) {
    console.log("▶ building extension (vite x3 + manifest + icons)…");
    const build = spawnSync(process.execPath, [resolve(ROOT, "build.js")], {
      stdio: "inherit",
    });
    if (build.status !== 0) {
      console.error("✖ build failed — nothing was packaged.");
      process.exit(build.status ?? 1);
    }
    // build.js already packaged the zip as part of its run; make sure it exists.
  }

  // 3. Package -------------------------------------------------------------------
  let zipPath = resolve(RELEASES_DIR, `deepseek-supervisor-v2-v${version}.zip`);
  if (skipBuild || !existsSync(zipPath)) {
    console.log("▶ packaging dist/…");
    const result = await packageDist();
    zipPath = result.path;
  }

  // 4. Checksum ------------------------------------------------------------------
  const hash = sha256File(zipPath);
  const checksumPath = `${zipPath}.sha256`;
  // "<hash>  <filename>" format so `sha256sum -c <file>.sha256` just works.
  writeFileSync(checksumPath, `${hash}  ${basename(zipPath)}\n`);
  const bytes = statSync(zipPath).size;

  console.log("\n============================== RELEASE ARTIFACTS ==============================");
  console.log(`  zip:      ${zipPath} (${formatBytes(bytes)})`);
  console.log(`  checksum: ${checksumPath}`);
  console.log(`  sha256:   ${hash}`);
  console.log("===============================================================================");
  console.log(
    `\nNext steps (full checklist: docs/RELEASE_CHECKLIST.md):` +
      `\n  1. Test: load dist/ (or the unzipped release) via chrome://extensions → Load unpacked` +
      `\n  2. Update CHANGELOG.md for ${version}` +
      `\n  3. Commit: git commit -am "chore(release): v${version}"` +
      `\n  4. Publish: git tag v${version} && git push origin main --follow-tags` +
      `\n     → GitHub Actions (.github/workflows/release.yml) creates the Release and uploads the zip + checksum` +
      `\n     Manual alternative: gh release create v${version} --generate-notes "${basename(zipPath)}" "${basename(zipPath)}.sha256"` +
      `\n  ${REPO}/actions`
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(`✖ release failed: ${err.message}`);
    process.exit(1);
  });
}
