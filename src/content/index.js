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
  i18n.init(state.settings.syncLocale ? null : state.settings.locale);

  injectHookScript();
  setupBridgeEvents();
  mountUi();
  bindStorageChangeListener();
  pushConfigToPage();
  setTimeout(() => pushConfigToPage(), 500);
  setTimeout(() => pushConfigToPage(), 1500);
  setTimeout(() => pushConfigToPage(), 3000);
  initSettingsIntegration();
  initMemoryScanner();
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
