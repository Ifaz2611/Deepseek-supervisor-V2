/**
 * Bridge between content script (ISOLATED world) and injected script (MAIN world).
 * Stealth: uses short, non-descript event names. No console output.
 */

import state from "./state.js";
import { STORAGE_KEYS } from "../lib/constants.js";

const EVT_CONFIG = "dsm:cu";
const EVT_REQUEST = "dsm:rq";
const HOOK_ID = "__dsm_hook";

export function setupBridgeEvents() {
  window.addEventListener(EVT_REQUEST, () => {
    pushConfigToPage();
  });
}

export async function pushConfigToPage() {
  try {
    const detail = {
      skills: state.skills
        .filter((s) => s.active)
        .map((s) => ({ name: s.name, content: s.content })),
      memories: Object.entries(state.memories).map(([key, item]) => ({
        key,
        value: item.value,
        importance: item.importance,
      })),
      disableMemory: Boolean(state.settings.disableMemory),
    };
    window.dispatchEvent(new CustomEvent(EVT_CONFIG, {
      detail: JSON.stringify(detail),
    }));
  } catch (e) {
    // Silent fail
  }
}

export function injectHookScript() {
  if (document.getElementById(HOOK_ID)) return;
  const src = (() => {
    try { return chrome.runtime.getURL("injected.js"); } catch { return null; }
  })();
  if (!src) {
    console.warn("[DeepSeek Supervisor] chrome.runtime.getURL failed — injected script not loaded");
    return;
  }
  const script = document.createElement("script");
  script.id = HOOK_ID;
  script.src = src;
  script.async = false;
  script.onload = () => script.remove();
  script.onerror = () => console.warn("[DeepSeek Supervisor] injected.js failed to load");
  const target = document.head || document.documentElement;
  if (target) target.appendChild(script);
  else document.addEventListener("DOMContentLoaded", () => (document.head || document.documentElement).appendChild(script), { once: true });
}
