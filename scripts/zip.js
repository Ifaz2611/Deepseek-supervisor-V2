/**
 * Minimal, dependency-free ZIP writer for Chrome extension packaging.
 *
 * - Uses node:zlib deflateRawSync (method 8), falling back to "store" (method 0)
 *   when deflating does not shrink a file.
 * - Deterministic / reproducible: file timestamps are normalized to a fixed date,
 *   and entries are sorted, so identical content always produces an identical
 *   archive (and therefore an identical SHA-256 checksum).
 * - Files are written at the root of the archive (manifest.json at zip root),
 *   which is what the Chrome Web Store upload requires.
 */

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { deflateRawSync } from "zlib";

/** Fixed timestamp (UTC) baked into every zip entry for reproducible builds. */
const FIXED_DATE = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));

// ---------------------------------------------------------------------------
// CRC-32 (IEEE 802.3), required by the ZIP format.
// ---------------------------------------------------------------------------
function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toDosDateTime(date) {
  // DOS timestamps are local-time based; we use fixed UTC components so the
  // output does not depend on the machine's timezone.
  const time =
    (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1);
  const day =
    ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { time: time & 0xffff, date: day & 0xffff };
}

const OS_JUNK = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

function walkFiles(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (OS_JUNK.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, base, out);
    else if (entry.isFile()) {
      out.push({
        abs: full,
        rel: relative(base, full).split(/[\\/]/).join("/"),
      });
    }
  }
  return out;
}

export { FIXED_DATE };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a zip archive at `outZipPath` containing every file (recursively)
 * found in `srcDir`, stored at the root of the archive.
 *
 * @param {string} srcDir Directory whose contents are zipped.
 * @param {string} outZipPath Output .zip file path.
 * @param {{ timestamp?: Date }} [options]
 * @returns {Promise<{ path: string, bytes: number, entries: string[] }>}
 */
export async function zipDirectory(srcDir, outZipPath, { timestamp = FIXED_DATE } = {}) {
  const files = walkFiles(srcDir).sort((a, b) => a.rel.localeCompare(b.rel));
  const { time, date } = toDosDateTime(timestamp);

  const body = [];
  const centralNames = [];
  let offset = 0;

  for (const file of files) {
    const data = readFileSync(file.abs);
    const crc = crc32(data);

    let method = 8;
    let payload = deflateRawSync(data, { level: 9 });
    if (!payload || payload.length >= data.length) {
      method = 0;
      payload = data;
    }

    const name = Buffer.from(file.rel, "utf8");

    // Local file header (30 bytes) + name + data
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // local file header signature
    lfh.writeUInt16LE(20, 4); // version needed to extract
    lfh.writeUInt16LE(0x0800, 6); // general purpose flags: UTF-8 filenames
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(payload.length, 18); // compressed size
    lfh.writeUInt32LE(data.length, 22); // uncompressed size
    lfh.writeUInt16LE(name.length, 26);
    lfh.writeUInt16LE(0, 28); // extra field length

    body.push(lfh, name, payload);

    // Central directory header (46 bytes) + name
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); // central directory header signature
    cdh.writeUInt16LE((3 << 8) | 20, 4); // version made by: UNIX, spec 2.0
    cdh.writeUInt16LE(20, 6); // version needed to extract
    cdh.writeUInt16LE(0x0800, 8); // flags: UTF-8
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(time, 12);
    cdh.writeUInt16LE(date, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(payload.length, 20);
    cdh.writeUInt32LE(data.length, 24);
    cdh.writeUInt16LE(name.length, 28);
    cdh.writeUInt16LE(0, 30); // extra field length
    cdh.writeUInt16LE(0, 32); // file comment length
    cdh.writeUInt16LE(0, 34); // disk number start
    cdh.writeUInt16LE(0, 36); // internal file attributes
    cdh.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attrs: regular file, 0644
    cdh.writeUInt32LE(offset, 42); // relative offset of local header

    centralNames.push(Buffer.concat([cdh, name]));

    offset += lfh.length + name.length + payload.length;
  }

  const centralDir = Buffer.concat(centralNames);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  eocd.writeUInt16LE(0, 4); // number of this disk
  eocd.writeUInt16LE(0, 6); // disk with start of central directory
  eocd.writeUInt16LE(files.length, 8); // entries on this disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralDir.length, 12); // central directory size
  eocd.writeUInt32LE(offset, 16); // central directory offset
  eocd.writeUInt16LE(0, 20); // comment length

  const archive = Buffer.concat([...body, centralDir, eocd]);
  writeFileSync(outZipPath, archive);

  return {
    path: outZipPath,
    bytes: archive.length,
    entries: files.map((f) => f.rel),
  };
}

