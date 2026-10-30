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
 * Full MutationObserver options for the chat DOM. Keep this in one place:
 * calling observe() again (as withObserverPaused does) replaces the previous
 * options, so re-observing without `characterData` would silently stop
 * streaming-text detection.
 */
export const CHAT_OBSERVER_OPTIONS = {
  subtree: true,
  childList: true,
  characterData: true,
  characterDataOldValue: false,
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
      observer.observe(document.body, CHAT_OBSERVER_OPTIONS);
    }
  }
}

export default state;