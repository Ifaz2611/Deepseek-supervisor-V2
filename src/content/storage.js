/**
 * Storage layer — IndexedDB primary, chrome.storage.local fallback.
 *
 * Uses IndexedDB for robust, transactional memory storage (like SQLite).
 * Automatically migrates from chrome.storage.local on first run.
 */

import state from "./state.js";
import { pushConfigToPage } from "./bridge.js";
import { STORAGE_KEYS, DEFAULT_SETTINGS } from "../lib/constants.js";
import { i18n } from "../lib/i18n.svelte.js";
import {
  loadMemories as loadMemoriesFromIDB,
  saveMemoriesBatch,
  saveMemory as saveMemoryToIDB,
  deleteMemory as deleteMemoryFromIDB,
  migrateFromChromeStorage,
  isMigrationComplete,
} from "../lib/indexeddb-storage.js";

// ── IndexedDB availability check ──

let idbAvailable = false;

async function checkIDBAvailability() {
  try {
    if (typeof indexedDB === "undefined") return false;
    // Try to open a test database
    const testDB = indexedDB.open("__idb_test__", 1);
    return new Promise((resolve) => {
      testDB.onsuccess = () => {
        testDB.result.close();
        indexedDB.deleteDatabase("__idb_test__");
        resolve(true);
      };
      testDB.onerror = () => resolve(false);
      // Timeout fallback
      setTimeout(() => resolve(false), 1000);
    });
  } catch {
    return false;
  }
}

// ── Load ──

export async function loadStateFromStorage() {
  // Check IndexedDB availability
  idbAvailable = await checkIDBAvailability();

  if (idbAvailable) {
    // Run migration from chrome.storage.local if needed
    await migrateFromChromeStorage();
  }

  // Load locale updates (always from chrome.storage)
  const localeValues = await chrome.storage.local.get(["bds_locale_updates"]);
  if (localeValues.bds_locale_updates) {
    i18n.loadUpdatedLocales(localeValues.bds_locale_updates);
  }

  // Load settings
  const values = await chrome.storage.local.get([
    STORAGE_KEYS.settings,
    STORAGE_KEYS.skills,
    STORAGE_KEYS.memories,
  ]);

  const storedSettings = values[STORAGE_KEYS.settings] || {};
  state.settings = {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
  };

  // Load skills (chrome.storage is fine for skills)
  state.skills = normalizeSkills(values[STORAGE_KEYS.skills]);

  // Load memories - prefer IndexedDB, fallback to chrome.storage
  if (idbAvailable) {
    const idbMemories = await loadMemoriesFromIDB();
    if (idbMemories !== null) {
      state.memories = idbMemories;
    } else {
      // Fallback if IndexedDB load returned null
      state.memories = normalizeMemories(values[STORAGE_KEYS.memories]);
    }
  } else {
    state.memories = normalizeMemories(values[STORAGE_KEYS.memories]);
  }
}

/**
 * Save memories to the active storage backend.
 * Used by scanner.js for persistence.
 */
export async function saveMemoriesToStorage(memories) {
  if (idbAvailable) {
    const writes = Object.entries(memories).map(([key, item]) => ({
      key,
      value: item.value,
      importance: item.importance,
    }));
    const result = await saveMemoriesBatch(writes);
    return result.success;
  } else {
    // Fallback to chrome.storage.local
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.memories]: memories,
      });
      return true;
    } catch (err) {
      console.warn("Failed to save memories to chrome.storage:", err);
      return false;
    }
  }
}

/**
 * Save a single memory (convenience wrapper).
 */
export async function saveSingleMemory(key, value, importance) {
  if (idbAvailable) {
    return await saveMemoryToIDB(key, value, importance);
  } else {
    // Load current, update, save back
    const values = await chrome.storage.local.get([STORAGE_KEYS.memories]);
    const memories = normalizeMemories(values[STORAGE_KEYS.memories]);
    memories[key] = { value, importance };
    await chrome.storage.local.set({ [STORAGE_KEYS.memories]: memories });
    return true;
  }
}

/**
 * Delete a single memory.
 */
export async function deleteSingleMemory(key) {
  if (idbAvailable) {
    return await deleteMemoryFromIDB(key);
  } else {
    const values = await chrome.storage.local.get([STORAGE_KEYS.memories]);
    const memories = normalizeMemories(values[STORAGE_KEYS.memories]);
    delete memories[key];
    await chrome.storage.local.set({ [STORAGE_KEYS.memories]: memories });
    return true;
  }
}

// ── Normalize ──

export function normalizeSkills(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => ({
      id: String(item && item.id ? item.id : ""),
      name: String(item && item.name ? item.name : "Skill"),
      usage: String(item && item.usage ? item.usage : ""),
      content: String(item && item.content ? item.content : ""),
      active: item && typeof item.active === "boolean" ? item.active : true,
    }))
    .filter((item) => item.content.trim().length > 0);
}

export function normalizeMemories(raw) {
  const memories = {};

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const key = sanitizeMemoryKey(item && item.key);
      const value = String(item && item.value ? item.value : "").trim();
      if (!key || !value) continue;
      memories[key] = {
        value,
        importance: sanitizeMemoryImportance(item && item.importance),
      };
    }
    return memories;
  }

  if (!raw || typeof raw !== "object") return memories;

  for (const [unsafeKey, item] of Object.entries(raw)) {
    const key = sanitizeMemoryKey(unsafeKey);
    const value = String(item && item.value ? item.value : "").trim();
    if (!key || !value) continue;
    memories[key] = {
      value,
      importance: sanitizeMemoryImportance(item && item.importance),
    };
  }

  return memories;
}

export function sanitizeMemoryKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export function sanitizeMemoryImportance(input) {
  return String(input || "called").toLowerCase() === "always"
    ? "always"
    : "called";
}

// ── Storage change listener ──

export function bindStorageChangeListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes[STORAGE_KEYS.settings]) {
      state.settings = {
        ...DEFAULT_SETTINGS,
        ...(changes[STORAGE_KEYS.settings].newValue || {}),
      };
      i18n.init(state.settings.syncLocale ? null : state.settings.locale);
      if (state.ui) state.ui.refreshSettings();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dsm:sc"));
      }
    }

    if (changes[STORAGE_KEYS.skills]) {
      state.skills = normalizeSkills(changes[STORAGE_KEYS.skills].newValue);
      if (state.ui) state.ui.refreshSkills();
    }

    if (changes[STORAGE_KEYS.memories]) {
      state.memories = normalizeMemories(changes[STORAGE_KEYS.memories].newValue);
      if (state.ui) state.ui.refreshMemories();
    }

    if (changes.bds_locale_updates) {
      if (changes.bds_locale_updates.newValue) {
        i18n.loadUpdatedLocales(changes.bds_locale_updates.newValue);
      } else {
        i18n.resetLocales();
      }
    }

    pushConfigToPage();
  });
}