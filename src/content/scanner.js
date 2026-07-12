/**
 * DOM observation and memory-write scanning.
 *
 * Two jobs:
 * 1. Watch for assistant messages containing <BDS:memory_write> tags,
 *    save them to storage, and hide the tags from the UI.
 * 2. Strip injected blocks from the chat DOM so users never see raw tags.
 */

import state from "./state.js";
import { extractMemoryWritesFromBlock } from "./parser/memory-parser.js";

const PROCESSED_HASH = new Set();
const TAG_REGEX = /<dsmemory>[\s\S]*?<\/dsmemory>/gi;
const INJECTED_BLOCK_REGEX = /<MEMORY_SYSTEM>[\s\S]*?<\/MEMORY_SYSTEM>|<dsmemory>[\s\S]*?<\/dsmemory>|<BDS:SKILLS[\s\S]*?<\/BDS:SKILLS>|<BDS:memory_calls[\s\S]*?<\/BDS:memory_calls>/gi;

/** @type {MutationObserver | null} */
let observer = null;

/** @type {number | null} */
let periodicTimer = null;

/**
 * Start the memory scanner.
 */
export function initMemoryScanner() {
  if (observer) return;
  if (!document.body) return;

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        const text = mutation.target.textContent || "";
        if (text.includes("BDS:memory_write")) {
          processTextNode(mutation.target);
        }
        if (hasInjectedMarkers(text)) {
          stripTextNode(mutation.target);
        }
      }
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            processElement(node);
            stripElement(node);
          }
          if (node.nodeType === 3) {
            const t = node.textContent || "";
            if (t.includes("BDS:memory_write")) processTextNode(node);
            if (hasInjectedMarkers(t)) stripTextNode(node);
          }
        }
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    characterDataOldValue: false,
  });

  // Periodic scan fallback (every 2 seconds)
  periodicTimer = setInterval(() => {
    scanForMemoryTags();
    stripInjectedBlocksFromChat();
  }, 2000);

  // Initial immediate scan
  scanForMemoryTags();
  stripInjectedBlocksFromChat();
}

/**
 * Stop the scanner.
 */
export function stopMemoryScanner() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}

/**
 * Quick check for any injected markers in text.
 */
function hasInjectedMarkers(text) {
  return text.includes("MEMORY_SYSTEM")
    || text.includes("dsmemory")
    || text.includes("BDS:SKILLS")
    || text.includes("BDS:memory_calls")
    || text.includes("BDS:memory_write");
}

// ── Memory Write Scanning ──

function scanForMemoryTags() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = node.textContent || "";
        if (text.includes("BDS:memory_write")) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  let textNode;
  while ((textNode = walker.nextNode())) {
    processTextNode(textNode);
  }
}

function processTextNode(textNode) {
  const text = textNode.textContent || "";
  if (!text.includes("BDS:memory_write")) return;

  const hash = hashText(text);
  if (PROCESSED_HASH.has(hash)) return;
  PROCESSED_HASH.add(hash);

  if (PROCESSED_HASH.size > 1000) {
    const first = PROCESSED_HASH.values().next().value;
    PROCESSED_HASH.delete(first);
  }

  const writes = extractMemoryWritesFromBlock(text);
  if (writes.length > 0) {
    saveMemoryWrites(writes);
  }

  hideTagsFromTextNode(textNode);
}

function processElement(element) {
  if (!element || element.nodeType !== 1) return;
  const tag = element.tagName?.toLowerCase();
  if (tag === "script" || tag === "style" || tag === "noscript") return;

  const text = element.textContent || "";
  if (!text.includes("BDS:memory_write")) return;

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const t = node.textContent || "";
        if (t.includes("BDS:memory_write")) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  let textNode;
  while ((textNode = walker.nextNode())) {
    processTextNode(textNode);
  }
}

function hideTagsFromTextNode(textNode) {
  const text = textNode.textContent || "";
  if (!text.includes("<dsmemory>")) return;

  const cleaned = text.replace(TAG_REGEX, "").trim();
  if (cleaned !== text) {
    if (cleaned) {
      textNode.textContent = cleaned;
    } else {
      const parent = textNode.parentElement;
      if (parent) {
        parent.style.display = "none";
      }
    }
  }
}

// ── Block Stripping ──

function stripInjectedBlocksFromChat() {
  const allElements = document.querySelectorAll(
    '[class*="ds-markdown"], [class*="message-content"], [class*="chat-message"], [class*="markdown"], [class*="msg-content"], [class*="user-message"]'
  );

  for (const el of allElements) {
    const text = el.textContent || "";
    if (!hasInjectedMarkers(text)) continue;
    stripElement(el);
  }

  stripFromTextWalker(document.body);
}

function stripElement(rootEl) {
  if (!rootEl || rootEl.nodeType !== 1) return;
  const tag = rootEl.tagName?.toLowerCase();
  if (tag === "script" || tag === "style" || tag === "noscript") return;

  const walker = document.createTreeWalker(
    rootEl,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const t = node.textContent || "";
        if (hasInjectedMarkers(t)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  for (const textNode of textNodes) {
    stripTextNode(textNode);
  }
}

function stripTextNode(textNode) {
  const text = textNode.textContent || "";
  if (!hasInjectedMarkers(text)) return;

  const cleaned = text
    .replace(INJECTED_BLOCK_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned !== text) {
    if (cleaned) {
      textNode.textContent = cleaned;
    } else {
      const parent = textNode.parentElement;
      if (parent && !parent.classList?.contains("ds-markdown")) {
        parent.style.display = "none";
      }
    }
  }
}

function stripFromTextWalker(root) {
  if (!root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const t = node.textContent || "";
        if (hasInjectedMarkers(t) && t.length < 50000) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  let textNode;
  while ((textNode = walker.nextNode())) {
    const text = textNode.textContent || "";
    const cleaned = text
      .replace(INJECTED_BLOCK_REGEX, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (cleaned !== text && text.length < 50000) {
      if (cleaned) {
        textNode.textContent = cleaned;
      } else {
        const parent = textNode.parentElement;
        if (parent && !parent.classList?.contains("ds-markdown")) {
          parent.style.display = "none";
        }
      }
    }
  }
}

// ── Memory Write Saving ──

const BLACKLISTED_VALUES = new Set([
  "example_name", "extracted_name", "extracted_country", "extracted_language",
  "placeholder", "example", "[fact from user", "[extracted_",
  "[user_name]", "[user_country]", "[user_language]",
  "your_name_here", "your_country_here", "sample_name",
]);

function isValidMemoryWrite(write, existing) {
  if (!write.key || !write.value) return false;

  const valueLower = write.value.toLowerCase().trim();

  for (const blacklisted of BLACKLISTED_VALUES) {
    if (valueLower.includes(blacklisted)) return false;
  }

  if (/\[.*?\]|\{.*?\}|<.*?>/.test(write.value)) return false;
  if (write.key === "user_name" && write.value.length < 2) return false;

  if (write.importance === "always" && existing[write.key]) {
    const existingVal = existing[write.key].value.toLowerCase();
    if (write.key === "user_name" && existingVal !== valueLower) {
      if (valueLower.length < 3 || /\d/.test(valueLower)) return false;
    }
  }

  return true;
}

async function saveMemoryWrites(writes) {
  try {
    const existing = state.memories || {};
    let changed = false;
    const savedKeys = [];

    for (const write of writes) {
      if (!isValidMemoryWrite(write, existing)) continue;

      const existingEntry = existing[write.key];
      if (existingEntry && existingEntry.value === write.value) continue;

      existing[write.key] = {
        value: write.value,
        importance: write.importance,
      };
      changed = true;
      savedKeys.push(write.key);
    }

    if (changed) {
      state.memories = existing;

      const { saveMemoriesToStorage } = await import("./storage.js");
      await saveMemoriesToStorage(existing);

      if (savedKeys.length > 0) {
        showInlineNotification(savedKeys);
      }
    }
  } catch (error) {
    // Silent fail
  }
}

function showInlineNotification(keys) {
  const thinkingBlock =
    document.querySelector('[class*="ds-thinking"]') ||
    document.querySelector('[class*="thinking"]') ||
    document.querySelector('[class*="thought"]');

  if (!thinkingBlock) return;

  const notif = document.createElement("div");
  notif.className = "dsmemory-inline-notif";
  notif.textContent = `Memory saved: ${keys.join(", ")}`;
  notif.style.cssText = `
    padding: 6px 12px;
    margin-bottom: 8px;
    font-size: 12px;
    color: #8e8ea0;
    background: transparent;
    border-radius: 6px;
    animation: dsmemory-fade 3s ease forwards;
  `;

  thinkingBlock.parentElement?.insertBefore(notif, thinkingBlock);

  setTimeout(() => {
    notif.remove();
  }, 3200);
}

function hashText(text) {
  return `${text.slice(0, 200)}:${text.length}`;
}
