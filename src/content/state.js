/**
 * Centralized extension state.
 *
 * After the scope reduction this only carries the data the content script
 * needs to (a) mount the UI, (b) hand off to the injected script, and
 * (c) keep the DOM observer quiet while the UI mounts.
 */

import { DEFAULT_SETTINGS } from "../lib/constants.js";

const state = {
  settings: { ...DEFAULT_SETTINGS },
  skills: [],
  memories: {},
  observer: null,
  scanTimer: 0,
  /** @type {import('./ui/mount.js').UiApi | null} */
  ui: null,
};

/**
 * Run `fn` with the chat-DOM MutationObserver paused so that DOM mutations
 * the extension itself causes don't re-trigger scan handlers.
 */
export function withObserverPaused(fn) {
  const observer = state.observer;
  if (observer) observer.disconnect();
  try {
    return fn();
  } finally {
    if (observer && document.body) {
      observer.observe(document.body, { subtree: true, childList: true });
    }
  }
}

export default state;