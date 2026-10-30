/**
 * Mount the Svelte UI into the page.
 */

import { mount } from "svelte";
import App from "./App.svelte";
import state from "../state.js";

/**
 * @typedef {object} UiApi
 * @property {(message: string) => void} showToast
 * @property {() => void} refreshSettings
 * @property {() => void} refreshSkills
 * @property {() => void} refreshMemories
 */

/**
 * Mount the BDS UI and return the API object.
 * @returns {UiApi}
 */
export function mountUi() {
  if (document.getElementById("bds-root")) return state.ui;

  const root = document.createElement("div");
  root.id = "bds-root";
  document.body.appendChild(root);

  const app = mount(App, { target: root });

  // Floating fallback button — guarantees an entry point even if the
  // DeepSeek dropdown selector changes. Styled by #bds-toggle in content.css.
  ensureFloatingButton();

  /** @type {UiApi} */
  const api = {
    showToast: (message) => app.showToast(message),
    refreshSettings: () => app.refreshSettings(),
    refreshSkills: () => app.refreshSkills(),
    refreshMemories: () => app.refreshMemories(),
  };

  state.ui = api;
  return api;
}

function ensureFloatingButton() {
  if (document.getElementById("bds-toggle")) return;
  const btn = document.createElement("button");
  btn.id = "bds-toggle";
  btn.type = "button";
  btn.title = "Open DeepSeek Supervisor — Memory & Skills (Alt+M)";
  btn.setAttribute("aria-label", "Open DeepSeek Supervisor");
  btn.innerHTML = `
    <span class="bds-toggle-pill-inner">
      <span class="bds-toggle-icon-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 2a5 5 0 0 0-5 5v1a4 4 0 0 0-3 3.86 4.5 4.5 0 0 0 2 3.86V17a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-1.28a4.5 4.5 0 0 0 2-3.86 4 4 0 0 0-3-3.86V7a5 5 0 0 0-5-5z"></path>
          <line x1="12" y1="2" x2="12" y2="8"></line>
          <line x1="9" y1="12" x2="15" y2="12"></line>
          <line x1="9" y1="16" x2="15" y2="16"></line>
        </svg>
        <span class="bds-toggle-pulse-dot" title="Memory active"></span>
      </span>
      <span class="bds-toggle-label-full">Memory & Skills</span>
      <span class="bds-toggle-kbd-badge">Alt+M</span>
    </span>
  `;
  btn.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("dsm:open"));
  });
  // Keep it above DeepSeek's own UI but below our modal (z-index 2147483646 vs 2147483647)
  const root = document.getElementById("bds-root");
  if (root) root.appendChild(btn);
  else document.body.appendChild(btn);
}
