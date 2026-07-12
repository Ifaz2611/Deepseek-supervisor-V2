/**
 * Content script entry point.
 *
 * Responsibilities (memory + skills extension only):
 * - Wait for document.body
 * - Load state from chrome.storage
 * - Inject the MAIN-world hook script
 * - Set up bridge events
 * - Mount Svelte UI
 * - Bind storage change listener
 * - Push config to injected script
 * - Inject the "Memory & Skills" entry into DeepSeek's settings dropdown
 */

import "bds-platform-globals";
import "../styles/content.css";

import state from "./state.js";
import { loadStateFromStorage, bindStorageChangeListener } from "./storage.js";
import { injectHookScript, setupBridgeEvents, pushConfigToPage } from "./bridge.js";
import { mountUi } from "./ui/mount.js";
import { initSettingsIntegration } from "./ui/SettingsIntegration.js";
import { initMemoryScanner } from "./scanner.js";
import { i18n } from "../lib/i18n.svelte.js";

const BOOTSTRAP = Symbol.for("__dsmInit");

if (!window[BOOTSTRAP]) {
  Object.defineProperty(window, BOOTSTRAP, { value: true, writable: false });
  init().catch(() => {});
}

async function init() {
  await waitForBody();
  await loadStateFromStorage();

  // Initialize localization locale
  i18n.init(state.settings.syncLocale ? null : state.settings.locale);

  injectHookScript();
  setupBridgeEvents();
  mountUi();
  bindStorageChangeListener();
  pushConfigToPage();

  // Retry config push to handle race condition with injected script loading.
  // The injected script requests config on load, but timing can vary.
  setTimeout(() => pushConfigToPage(), 500);
  setTimeout(() => pushConfigToPage(), 1500);
  setTimeout(() => pushConfigToPage(), 3000);

  // Inject a "Memory & Skills" entry into DeepSeek's settings dropdown.
  initSettingsIntegration();

  // Start scanning assistant messages for <BDS:memory_write> tags.
  initMemoryScanner();

  // Live-update: re-push config whenever settings change.
  window.addEventListener("dsm:sc", () => {
    pushConfigToPage();
  });
}

async function waitForBody() {
  if (document.body) return;
  await new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });
}
