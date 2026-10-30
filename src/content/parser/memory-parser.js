/**
 * Extract <BDS:memory_write> tags from assistant message text.
 *
 * Works with any language — the regex matches XML tags regardless of
 * the content language inside the value field.
 */

const MEMORY_WRITE_REGEX =
  /<BDS:memory_write\b([^>]*)>([\s\S]*?)<\/BDS:memory_write>/gi;

const ATTRIBUTE_REGEX = /([a-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

/**
 * @param {string} text - Raw text from an assistant message
 * @returns {Array<{key: string, value: string, importance: 'always'|'called'}>}
 */
export function extractMemoryWrites(text) {
  if (!text || typeof text !== "string") return [];

  const writes = [];
  let match;

  // Reset regex lastIndex for reuse
  MEMORY_WRITE_REGEX.lastIndex = 0;

  while ((match = MEMORY_WRITE_REGEX.exec(text)) !== null) {
    const attrs = parseAttributes(match[1]);
    const key = sanitizeKey(attrs.key);
    const importance = String(attrs.importance || "called").toLowerCase() === "always"
      ? "always"
      : "called";
    const value = match[2].trim();

    if (key && value) {
      writes.push({ key, value, importance });
    }
  }

  return writes;
}

/**
 * Parse tag attributes in any order (models do not always follow the exact
 * order shown in the prompt).
 */
function parseAttributes(source) {
  const attrs = {};
  ATTRIBUTE_REGEX.lastIndex = 0;
  let match;
  while ((match = ATTRIBUTE_REGEX.exec(source || "")) !== null) {
    attrs[match[1].toLowerCase()] = match[2] !== undefined ? match[2] : match[3];
  }
  return attrs;
}

/**
 * Also extract memory writes wrapped in <dsmemory> tags,
 * as well as any JSON arrays inside <dsmemory> tags.
 */
export function extractMemoryWritesFromBlock(text) {
  if (!text || typeof text !== "string") return [];

  const writes = extractMemoryWrites(text);
  const seenKeys = new Set(writes.map((w) => w.key));

  // Also check for JSON array inside <dsmemory> tags (e.g. from memory export)
  const dsmemoryRegex = /<dsmemory[^>]*>([\s\S]*?)<\/dsmemory>/gi;
  let blockMatch;
  while ((blockMatch = dsmemoryRegex.exec(text)) !== null) {
    const content = blockMatch[1].trim();
    if (content.startsWith("[") && content.endsWith("]")) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (!item || typeof item !== "object") continue;
            const key = sanitizeKey(item.key);
            const value = String(item.value || "").trim();
            const importance = String(item.importance || "called").toLowerCase() === "always"
              ? "always"
              : "called";
            if (key && value && !seenKeys.has(key)) {
              seenKeys.add(key);
              writes.push({ key, value, importance });
            }
          }
        }
      } catch (_) {}
    }
  }

  return writes;
}

function sanitizeKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}
