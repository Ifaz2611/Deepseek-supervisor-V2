/**
 * Extract <BDS:memory_write> tags from assistant message text.
 *
 * Works with any language — the regex matches XML tags regardless of
 * the content language inside the value field.
 */

const MEMORY_WRITE_REGEX =
  /<BDS:memory_write\s+key="([^"]+)"\s+importance="(always|called)">([\s\S]*?)<\/BDS:memory_write>/gi;

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
    const key = sanitizeKey(match[1]);
    const importance = match[2].toLowerCase() === "always" ? "always" : "called";
    const value = match[3].trim();

    if (key && value) {
      writes.push({ key, value, importance });
    }
  }

  return writes;
}

/**
 * Also extract memory writes wrapped in <dsmemory> tags.
 */
export function extractMemoryWritesFromBlock(text) {
  if (!text || typeof text !== "string") return [];

  const blockRegex = /<dsmemory>([\s\S]*?)<\/dsmemory>/gi;
  let allWrites = [];
  let blockMatch;

  blockRegex.lastIndex = 0;

  while ((blockMatch = blockRegex.exec(text)) !== null) {
    const blockContent = blockMatch[1];
    // Only extract memory_write tags, NOT memory_calls
    const writes = extractMemoryWrites(blockContent);
    allWrites = allWrites.concat(writes);
  }

  // Also check outside of dsmemory tags (fallback)
  if (allWrites.length === 0) {
    allWrites = extractMemoryWrites(text);
  }

  return allWrites;
}

function sanitizeKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}
