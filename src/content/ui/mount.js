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
  btn.innerHTML = '<span class="bds-toggle-full">🧠 Memory & Skills</span><span class="bds-toggle-short">🧠</span>';
  btn.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("dsm:open"));
  });
  // Keep it above DeepSeek's own UI but below our modal (z-index 2147483646 vs 2147483647)
  const root = document.getElementById("bds-root");
  if (root) root.appendChild(btn);
  else document.body.appendChild(btn);
}