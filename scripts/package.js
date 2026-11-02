/**
 * Package the built extension (dist/) into a distributable zip.
 *
 * Usage:
 *   npm run package          # zip dist/ → releases/deepseek-supervisor-v2-v<version>.zip
 *
 * The zip is reproducible and contains the unpacked extension at the root
 * (manifest.json at zip root), ready for "Load unpacked" and Chrome Web Store.
 */

import { existsSync, mkdirSync, statSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { zipDirectory } from "./zip.js";
import { readPkg, ROOT } from "./sync-version.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DIST_DIR = resolve(ROOT, "dist");
export const RELEASES_DIR = resolve(ROOT, "releases");

/** Files the manifest references — the extension is broken without any of them. */
export const REQUIRED_DIST_FILES = [
  "manifest.json",
  "content.js",
  "content.css",
  "background.js",
  "injected.js",
  "icon16.png",
  "icon48.png",
  "icon128.png",
];

/** Canonical distribution artifact name, e.g. deepseek-supervisor-v2-v1.0.1.zip */
export function distZipName(version = readPkg().version) {
  return `deepseek-supervisor-v2-v${version}.zip`;
}

/**
 * Verify dist/ contains every file required by the manifest.
 * Throws with a readable message when something is missing.
 */
export function verifyDist(distDir = DIST_DIR) {
  if (!existsSync(resolve(distDir, "manifest.json"))) {
    throw new Error(`dist/ not found or incomplete (${distDir}). Run \`npm run build\` first.`);
  }
  const missing = REQUIRED_DIST_FILES.filter((f) => !existsSync(resolve(distDir, f)));
  if (missing.length > 0) {
    throw new Error(
      `dist/ is missing required file(s): ${missing.join(", ")}.\n` +
        `These are referenced by static/manifest.json — rerun \`npm run build\` and check for build errors.`
    );
  }
  return REQUIRED_DIST_FILES;
}

/**
 * Zip dist/ into releases/. Returns { path, bytes, entries }.
 */
export async function packageDist({ distDir = DIST_DIR, outDir = RELEASES_DIR } = {}) {
  verifyDist(distDir);
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, distZipName());
  const result = await zipDirectory(distDir, outPath);
  return result;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const result = await packageDist();
    console.log(
      `✔ packaged ${result.entries.length} files → ${result.path} (${formatBytes(result.bytes)})`
    );
    console.log("  manifest.json sits at the zip root — the zip is ready for distribution.");
  } catch (err) {
    console.error(`✖ packaging failed: ${err.message}`);
    process.exitCode = 1;
  }
}
