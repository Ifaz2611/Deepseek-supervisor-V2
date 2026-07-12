/**
 * Injected script — runs in MAIN world.
 * Patches fetch/XHR to inject skills + memory context into API calls.
 * Stealth: no global flags, no console output, no fingerprintable patterns.
 */

import { normalizeConfig } from "./config.js";
import { patchFetch } from "./fetch-patch.js";
import { patchXmlHttpRequest } from "./xhr-patch.js";

(function () {
  "use strict";

  const CHAT_COMPLETION_PATH = "/api/v0/chat/completion";

  const state = {
    config: normalizeConfig({}),
    sessionUserMsgCounts: {},
  };

  // Use a non-enumerable, hard-to-detect flag
  const flag = Symbol.for("__dsm");
  if (Object.getOwnPropertyDescriptor(window, flag)) return;
  Object.defineProperty(window, flag, { value: true, writable: false, configurable: false });

  window.addEventListener("dsm:cu", (event) => {
    let nextConfig = event && event.detail ? event.detail : {};
    if (typeof nextConfig === "string") {
      try { nextConfig = JSON.parse(nextConfig); } catch (e) { return; }
    }
    state.config = normalizeConfig(nextConfig || {});
  });

  // Request config immediately and also after a short delay
  // to handle the race condition where the content script's
  // listener isn't set up yet when we first fire.
  window.dispatchEvent(new CustomEvent("dsm:rq"));
  setTimeout(() => window.dispatchEvent(new CustomEvent("dsm:rq")), 500);
  setTimeout(() => window.dispatchEvent(new CustomEvent("dsm:rq")), 1500);

  // Request fresh config before every message send.
  // This ensures memories are always up-to-date.
  function requestFreshConfig() {
    window.dispatchEvent(new CustomEvent("dsm:rq"));
  }

  patchFetch(state, isChatUrl, requestFreshConfig);
  patchXmlHttpRequest(state, isChatUrl, requestFreshConfig);

  function isChatUrl(url) {
    const s = String(url || "");
    return s.includes(CHAT_COMPLETION_PATH)
      || s.includes("/api/v0/chat/edit_message")
      || s.includes("/api/v0/chat_session/fetch_page");
  }
})();