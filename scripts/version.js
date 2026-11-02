/**
 * Set the release version everywhere it lives, in one command:
 *
 *   npm run version:set -- 1.2.3
 *   npm run version:set -- major   (v1.2.3 → v2.0.0)
 *   npm run version:set -- minor   (v1.2.3 → v1.3.0)
 *   npm run version:set -- patch   (v1.2.3 → v1.2.4)
 *
 * Updates:
 *   - package.json
 *   - package-lock.json (root + packages[""] entries, when present)
 *   - static/manifest.json
 *
 * This project follows Semantic Versioning (https://semver.org):
 *   MAJOR.MINOR.PATCH  — see "Versioning" in contributing.md
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { ROOT, readPkg, readManifest } from "./sync-version.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_PATH = resolve(ROOT, "package.json");
const LOCK_PATH = resolve(ROOT, "package-lock.json");
const MANIFEST_PATH = resolve(ROOT, "static/manifest.json");

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/;

function usage() {
  console.error("Usage: npm run version:set -- <x.y.z | major | minor | patch>");
  process.exit(1);
}

function bump(version, kind) {
  const m = SEMVER_RE.exec(version.trim());
  if (!m) {
    console.error(`✖ cannot bump "${version}" — current version is not plain semver.`);
    process.exit(1);
  }
  const [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (kind === "major") return `${maj + 1}.0.0`;
  if (kind === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const arg = process.argv[2];
  if (!arg) usage();

  const pkg = readPkg();
  const current = pkg.version;
  const semverMatch = SEMVER_RE.exec(arg.trim());

  let target;
  if (semverMatch) {
    target = `${semverMatch[1]}.${semverMatch[2]}.${semverMatch[3]}`;
  } else if (["major", "minor", "patch"].includes(arg)) {
    target = bump(current, arg);
  } else {
    console.error(`✖ "${arg}" is not a valid version (x.y.z) or bump kind (major|minor|patch).`);
    usage();
  }

  if (target === current) {
    console.log(`✔ version is already ${target} — nothing to do.`);
    process.exit(0);
  }

  pkg.version = target;
  writeJson(PKG_PATH, pkg);
  console.log(`✔ package.json: ${current} → ${target}`);

  if (existsSync(LOCK_PATH)) {
    const lock = JSON.parse(readFileSync(LOCK_PATH, "utf8"));
    let lockTouched = false;
    if (lock.version !== undefined) {
      lock.version = target;
      lockTouched = true;
    }
    if (lock.packages && lock.packages[""]) {
      lock.packages[""].version = target;
      lockTouched = true;
    }
    if (lockTouched) {
      writeJson(LOCK_PATH, lock);
      console.log(`✔ package-lock.json: → ${target}`);
    }
  }

  const manifest = readManifest();
  const manifestFrom = manifest.version;
  manifest.version = target;
  writeJson(MANIFEST_PATH, manifest);
  console.log(`✔ static/manifest.json: ${manifestFrom} → ${target}`);

  console.log(
    `\nNext steps:\n` +
      `  1. Add a section for ${target} in CHANGELOG.md\n` +
      `  2. npm run release   # build + package + checksum\n` +
      `  3. Test in Chrome, then follow docs/RELEASE_CHECKLIST.md to publish`
  );
}
