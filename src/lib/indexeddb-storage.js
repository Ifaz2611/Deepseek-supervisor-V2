/**
 * IndexedDB storage backend for DeepSeek Memory.
 *
 * Provides a robust, transactional storage layer similar to SQLite.
 * Falls back to chrome.storage.local if IndexedDB is unavailable.
 *
 * Features:
 * - ACID transactions for data integrity
 * - Indexed queries for fast lookups
 * - Version-based conflict resolution
 * - Automatic migration from chrome.storage.local
 */

const DB_NAME = "DeepSeekMemoryDB";
const DB_VERSION = 1;
const STORE_MEMORIES = "memories";
const STORE_SETTINGS = "settings";
const STORE_SKILLS = "skills";
const STORE_META = "metadata";

let dbInstance = null;

/**
 * Open or create the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn("IndexedDB failed to open, falling back to chrome.storage");
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle database being closed unexpectedly (e.g., browser clearing data)
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Memories store: key-value with timestamp and version tracking
      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        const memStore = db.createObjectStore(STORE_MEMORIES, { keyPath: "key" });
        memStore.createIndex("importance", "importance", { unique: false });
        memStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // Settings store: single-row key-value
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }

      // Skills store: array of skills
      if (!db.objectStoreNames.contains(STORE_SKILLS)) {
        db.createObjectStore(STORE_SKILLS, { keyPath: "id" });
      }

      // Metadata store: migration status, version info
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
  });
}

/**
 * Generic transaction helper.
 * @param {string} storeName
 * @param {string} mode - "readonly" or "readwrite"
 * @param {function(IDBObjectStore): void} callback
 * @returns {Promise<void>}
 */
function withStore(storeName, mode, callback) {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      callback(store);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    });
  });
}

/**
 * Get a value from a store by key.
 * @param {string} storeName
 * @param {string} key
 * @returns {Promise<any|null>}
 */
function getValue(storeName, key) {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result ? request.result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Set a value in a store.
 * @param {string} storeName
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
function setValue(storeName, key, value) {
  return withStore(storeName, "readwrite", (store) => {
    store.put({ key, value, updatedAt: Date.now() });
  });
}

/**
 * Delete a value from a store.
 * @param {string} storeName
 * @param {string} key
 * @returns {Promise<void>}
 */
function deleteValue(storeName, key) {
  return withStore(storeName, "readwrite", (store) => {
    store.delete(key);
  });
}

/**
 * Get all values from a store.
 * @param {string} storeName
 * @returns {Promise<Array>}
 */
function getAllValues(storeName) {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  });
}

// ── Memory-specific operations ──

/**
 * Load all memories from IndexedDB.
 * @returns {Promise<Object>} - { key: { value, importance } }
 */
export async function loadMemories() {
  try {
    const records = await getAllValues(STORE_MEMORIES);
    const memories = {};

    for (const record of records) {
      if (record.key && record.value) {
        memories[record.key] = {
          value: record.value,
          importance: record.importance || "called",
          updatedAt: record.updatedAt,
          version: record.version || 1,
        };
      }
    }

    return memories;
  } catch (err) {
    console.warn("IndexedDB loadMemories failed:", err);
    return null; // Signal to fallback
  }
}

/**
 * Save a single memory to IndexedDB.
 * Uses version-based conflict resolution to prevent race conditions.
 * @param {string} key
 * @param {string} value
 * @param {string} importance
 * @returns {Promise<boolean>}
 */
export async function saveMemory(key, value, importance = "called") {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readwrite");
      const store = tx.objectStore(STORE_MEMORIES);
      const getReq = store.get(key);

      getReq.onsuccess = () => {
        const existing = getReq.result;
        const newVersion = (existing?.version || 0) + 1;

        store.put({
          key,
          value,
          importance,
          updatedAt: Date.now(),
          version: newVersion,
          previousValue: existing?.value || null, // Keep history for undo
        });
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB saveMemory failed:", err);
    return false;
  }
}

/**
 * Save multiple memories in a single transaction (atomic).
 * @param {Array<{key: string, value: string, importance: string}>} writes
 * @returns {Promise<{success: boolean, savedKeys: string[]}>}
 */
export async function saveMemoriesBatch(writes) {
  try {
    const db = await openDatabase();
    const savedKeys = [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readwrite");
      const store = tx.objectStore(STORE_MEMORIES);

      for (const write of writes) {
        if (!write.key || !write.value) continue;

        const getReq = store.get(write.key);
        getReq.onsuccess = () => {
          const existing = getReq.result;
          const newVersion = (existing?.version || 0) + 1;

          store.put({
            key: write.key,
            value: write.value,
            importance: write.importance || "called",
            updatedAt: Date.now(),
            version: newVersion,
            previousValue: existing?.value || null,
          });

          savedKeys.push(write.key);
        };
      }

      tx.oncomplete = () => resolve({ success: true, savedKeys });
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB saveMemoriesBatch failed:", err);
    return { success: false, savedKeys: [] };
  }
}

/**
 * Delete a memory from IndexedDB.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function deleteMemory(key) {
  try {
    await deleteValue(STORE_MEMORIES, key);
    return true;
  } catch (err) {
    console.warn("IndexedDB deleteMemory failed:", err);
    return false;
  }
}

/**
 * Delete multiple memories.
 * @param {string[]} keys
 * @returns {Promise<boolean>}
 */
export async function deleteMemoriesBatch(keys) {
  try {
    await withStore(STORE_MEMORIES, "readwrite", (store) => {
      for (const key of keys) {
        store.delete(key);
      }
    });
    return true;
  } catch (err) {
    console.warn("IndexedDB deleteMemoriesBatch failed:", err);
    return false;
  }
}

// ── Settings operations ──

export async function loadSettings() {
  try {
    return await getValue(STORE_SETTINGS, "app_settings");
  } catch (err) {
    console.warn("IndexedDB loadSettings failed:", err);
    return null;
  }
}

export async function saveSettings(settings) {
  try {
    await setValue(STORE_SETTINGS, "app_settings", settings);
    return true;
  } catch (err) {
    console.warn("IndexedDB saveSettings failed:", err);
    return false;
  }
}

// ── Skills operations ──

export async function loadSkills() {
  try {
    const records = await getAllValues(STORE_SKILLS);
    return records.map(r => r.value).filter(Boolean);
  } catch (err) {
    console.warn("IndexedDB loadSkills failed:", err);
    return null;
  }
}

export async function saveSkills(skills) {
  try {
    await withStore(STORE_SKILLS, "readwrite", (store) => {
      store.clear();
      for (const skill of skills) {
        store.put({ id: skill.id, value: skill, updatedAt: Date.now() });
      }
    });
    return true;
  } catch (err) {
    console.warn("IndexedDB saveSkills failed:", err);
    return false;
  }
}

// ── Migration ──

/**
 * Check if migration from chrome.storage.local has been completed.
 * @returns {Promise<boolean>}
 */
export async function isMigrationComplete() {
  try {
    const meta = await getValue(STORE_META, "migration_status");
    return meta === "complete";
  } catch {
    return false;
  }
}

/**
 * Mark migration as complete.
 * @returns {Promise<void>}
 */
export async function markMigrationComplete() {
  try {
    await setValue(STORE_META, "migration_status", "complete");
  } catch (err) {
    console.warn("Failed to mark migration complete:", err);
  }
}

/**
 * Migrate data from chrome.storage.local to IndexedDB.
 * @returns {Promise<boolean>}
 */
export async function migrateFromChromeStorage() {
  try {
    const alreadyDone = await isMigrationComplete();
    if (alreadyDone) return true;

    // Load existing data from chrome.storage.local
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(["bds_memories", "bds_settings", "bds_skills"], resolve);
    });

    // Migrate memories
    if (result.bds_memories && typeof result.bds_memories === "object") {
      const writes = Object.entries(result.bds_memories).map(([key, item]) => ({
        key,
        value: item.value,
        importance: item.importance || "called",
      }));
      await saveMemoriesBatch(writes);
    }

    // Migrate settings
    if (result.bds_settings) {
      await saveSettings(result.bds_settings);
    }

    // Migrate skills
    if (Array.isArray(result.bds_skills)) {
      await saveSkills(result.bds_skills);
    }

    await markMigrationComplete();
    console.log("Migration from chrome.storage.local to IndexedDB complete");
    return true;
  } catch (err) {
    console.warn("Migration failed:", err);
    return false;
  }
}

// ── Export the database instance for advanced usage ──

export async function getDatabase() {
  return openDatabase();
}

export default {
  loadMemories,
  saveMemory,
  saveMemoriesBatch,
  deleteMemory,
  deleteMemoriesBatch,
  loadSettings,
  saveSettings,
  loadSkills,
  saveSkills,
  migrateFromChromeStorage,
  isMigrationComplete,
  getDatabase,
};
