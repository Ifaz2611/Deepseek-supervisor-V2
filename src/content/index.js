import "bds-platform-globals";
import "../styles/content.css";

import state from "./state.js";
import { loadStateFromStorage, bindStorageChangeListener } from "./storage.js";
import { injectHookScript, setupBridgeEvents, pushConfigToPage } from "./bridge.js";
import { mountUi } from "./ui/mount.js";
import { initSettingsIntegration } from "./ui/SettingsIntegration.js";
import { initMemoryScanner } from "./scanner.js";
import { i18n } from "../lib/i18n.svelte.js";
import { STORAGE_KEYS } from "../lib/constants.js";

const BOOTSTRAP = Symbol.for("__dsmInit");

if (!window[BOOTSTRAP]) {
  Object.defineProperty(window, BOOTSTRAP, { value: true, writable: false });
  init().catch((err) => {
    console.error("[DeepSeek Supervisor] init failed:", err);
    // Surface a visible toast even if Svelte hasn't mounted yet
    try {
      const t = document.createElement("div");
      t.textContent = "DeepSeek Supervisor failed to load — check console";
      t.style.cssText = "position:fixed;bottom:16px;right:16px;background:#ef4444;color:#fff;padding:10px 14px;border-radius:8px;z-index:2147483647;font:13px sans-serif";
      document.documentElement.appendChild(t);
      setTimeout(() => t.remove(), 6000);
    } catch {}
  });
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
  handlePendingMemoryImport();
  setupGlobalTriggers();
  window.addEventListener("dsm:sc", () => {
    pushConfigToPage();
  });
}

function setupGlobalTriggers() {
  // Allow background.js (extension icon click) to open the drawer
  try {
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "BDS_OPEN_DRAWER") {
          window.dispatchEvent(new CustomEvent("dsm:open"));
        }
      });
    }
  } catch {}

  // Keyboard shortcut: Alt+M (and Ctrl+Shift+M as alias) — doesn't conflict with DeepSeek
  window.addEventListener("keydown", (e) => {
    const isAltM = e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "m";
    const isCtrlShiftM = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "m";
    if (isAltM || isCtrlShiftM) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("dsm:open"));
    }
  });

  // Diagnostic: log once so user knows the extension is alive
  console.log("[DeepSeek Supervisor] content script loaded — press Alt+M or click 🧠 to open");
}

async function handlePendingMemoryImport() {
  try {
    const data = await chrome.storage.local.get([STORAGE_KEYS.pendingMemoryImport]);
    const pending = data[STORAGE_KEYS.pendingMemoryImport];
    if (!pending || typeof pending !== "string" || !pending.trim()) return;

    // Only clear the pending import after it has actually been inserted.
    // The chat input may not exist yet when the content script starts, so
    // poll briefly instead of deleting the prompt and losing it.
    const injected = await fillChatInput(pending.trim());
    if (!injected) return;

    await chrome.storage.local.remove([STORAGE_KEYS.pendingMemoryImport]);
    if (state.ui) state.ui.showToast("Memory import ready — press Send to process.");
  } catch (_) {}
}

async function fillChatInput(value, attempts = 20) {
  const selector = 'textarea[placeholder], div[contenteditable="true"], #chat-input, textarea';
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const input = document.querySelector(selector);
    if (input) {
      if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
        input.focus();
        const proto = input.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (nativeSetter) {
          nativeSetter.call(input, value);
        } else {
          input.value = value;
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      if (input.isContentEditable) {
        input.focus();
        if (typeof document.execCommand === "function") {
          document.execCommand("selectAll", false, null);
          document.execCommand("insertText", false, value);
        } else {
          input.textContent = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return true;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
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
