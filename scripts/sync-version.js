/**
 * Keeps the extension version in sync across:
 *   package.json  (source of truth)
 *   static/manifest.json
 *
 * Usage:
 *   npm run version:sync            # copy package.json version into the manifest
 *   npm run version:sync -- --check # verify only (exit 1 on mismatch, no writes)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..");
const MANIFEST_PATH = resolve(ROOT, "static/manifest.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readManifest() {
  return readJson(MANIFEST_PATH);
}

export function readPkg() {
  return readJson(resolve(ROOT, "package.json"));
}

/**
 * Throw a helpful error when package.json and static/manifest.json versions
 * disagree. Used by build.js so a broken build never gets packaged.
 */
export function assertVersionsInSync() {
  const pkg = readPkg();
  const manifest = readManifest();
  if (pkg.version !== manifest.version) {
    throw new Error(
      `Version mismatch: package.json is ${pkg.version}, but static/manifest.json is ${manifest.version}.\n` +
        `Run \`npm run version:sync\` (or \`npm run version:set -- <version>\`) and rebuild.`
    );
  }
  return pkg.version;
}

/**
 * Copy the package.json version into static/manifest.json.
 * Returns { changed, version, from? }.
 */
export function syncManifestVersion() {
  const pkg = readPkg();
  const manifest = readManifest();
  if (pkg.version === manifest.version) {
    return { changed: false, version: pkg.version };
  }
  const from = manifest.version;
  manifest.version = pkg.version;
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  return { changed: true, version: pkg.version, from };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const checkOnly = process.argv.includes("--check");
  try {
    if (checkOnly) {
      assertVersionsInSync();
      const { version } = readPkg();
      console.log(`✔ versions in sync: ${version} (package.json ↔ static/manifest.json)`);
    } else {
      const result = syncManifestVersion();
      if (result.changed) {
        console.log(`✔ synced static/manifest.json: ${result.from} → ${result.version}`);
      } else {
        console.log(`✔ already in sync: ${result.version}`);
      }
    }
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exitCode = 1;
  }
}
