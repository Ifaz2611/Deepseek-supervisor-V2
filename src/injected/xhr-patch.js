import { mutatePayload, stripBlocksFromJsonValue } from "./payload-mutator.js";

export function patchXmlHttpRequest(state, isChatCompletionUrl, requestFreshConfig) {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._dsm = { m: String(method || "GET").toUpperCase(), u: String(url || "") };
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    try {
      const meta = this._dsm || {};
      if (!isChatCompletionUrl(meta.u)) return originalSend.call(this, body);

      // Request fresh config before mutating
      if (requestFreshConfig) requestFreshConfig();

      if (meta.u.includes("/api/v0/chat_session/fetch_page")) {
        this.addEventListener("load", () => {
          try {
            const data = JSON.parse(this.responseText);
            // Strip injected blocks from chat history
            const cleaned = stripBlocksFromJsonValue(data);
            // Replace response text so React renders clean messages
            Object.defineProperty(this, "responseText", { value: JSON.stringify(cleaned), writable: false });
            Object.defineProperty(this, "response", { value: JSON.stringify(cleaned), writable: false });
            window.dispatchEvent(new CustomEvent("dsm:sd", { detail: JSON.stringify(cleaned) }));
          } catch (e) {}
        });
        return originalSend.call(this, body);
      }

      const bodyText = getXhrBodyText(body);
      if (!bodyText) return originalSend.call(this, body);

      let payload;
      try { payload = JSON.parse(bodyText); } catch { return originalSend.call(this, body); }

      const mutation = mutatePayload(payload, state);
      if (!mutation.changed) return originalSend.call(this, body);

      return originalSend.call(this, JSON.stringify(mutation.payload));
    } catch (error) {
      return originalSend.call(this, body);
    }
  };
}

function getXhrBodyText(body) {
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  return "";
}