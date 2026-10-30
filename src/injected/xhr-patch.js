import { mutatePayload, stripBlocksFromJsonValue } from "./payload-mutator.js";

function hasBlockMarkers(text) {
  return (
    typeof text === "string" &&
    (text.includes("MEMORY_SYSTEM") ||
      text.includes("dsmemory") ||
      text.includes("BDS:"))
  );
}

function cleanJsonText(text) {
  if (!hasBlockMarkers(text)) return text;
  try {
    return JSON.stringify(stripBlocksFromJsonValue(JSON.parse(text)));
  } catch {
    return text;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cleanResponseValue(value) {
  if (typeof value === "string") return cleanJsonText(value);
  if (Array.isArray(value) || isPlainObject(value)) {
    try {
      return stripBlocksFromJsonValue(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function patchXmlHttpRequest(state, isChatCompletionUrl, requestFreshConfig) {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const responseTextDescriptor = Object.getOwnPropertyDescriptor(
    XMLHttpRequest.prototype,
    "responseText"
  );
  const responseDescriptor = Object.getOwnPropertyDescriptor(
    XMLHttpRequest.prototype,
    "response"
  );

  XMLHttpRequest.prototype.open = function (method, url) {
    this._dsm = { m: String(method || "GET").toUpperCase(), u: String(url || "") };
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const meta = this._dsm || { m: "GET", u: "" };
    if (!isChatCompletionUrl(meta.u)) return originalSend.call(this, body);

    try {
      if (requestFreshConfig) requestFreshConfig();

      if (meta.u.includes("/api/v0/chat_session/fetch_page")) {
        installResponseCleaner(this, responseTextDescriptor, responseDescriptor);
        return originalSend.call(this, body);
      }

      if (meta.m === "POST") {
        const text = getXhrBodyText(body);
        if (text) {
          try {
            const payload = JSON.parse(text);
            const mutation = mutatePayload(payload, state);
            if (mutation.changed) {
              return originalSend.call(this, JSON.stringify(mutation.payload));
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    return originalSend.call(this, body);
  };
}

/**
 * Clean fetch_page responses lazily, at read time.
 *
 * The page normally registers its own `onload` handler before calling send(),
 * so a `load` listener added inside our send() wrapper would fire too late and
 * the app would read the raw response first. Shadowing the response accessors
 * on the XHR instance guarantees every read is scrubbed. It also preserves the
 * native response type (string for text, object for responseType="json")
 * instead of always returning a JSON string.
 */
function installResponseCleaner(xhr, textDescriptor, responseDescriptor) {
  if (xhr.__dsmCleanInstalled) return;
  try {
    Object.defineProperty(xhr, "__dsmCleanInstalled", { value: true });

    let cleanedText;
    let hasCleanedText = false;
    let cleanedResponse;
    let hasCleanedResponse = false;

    if (textDescriptor && typeof textDescriptor.get === "function") {
      Object.defineProperty(xhr, "responseText", {
        configurable: true,
        enumerable: true,
        get() {
          if (this.readyState === 4 && hasCleanedText) return cleanedText;
          const raw = textDescriptor.get.call(this);
          const cleaned = cleanJsonText(raw);
          if (this.readyState === 4) {
            cleanedText = cleaned;
            hasCleanedText = true;
          }
          return cleaned;
        },
      });
    }

    if (responseDescriptor && typeof responseDescriptor.get === "function") {
      Object.defineProperty(xhr, "response", {
        configurable: true,
        enumerable: true,
        get() {
          if (this.readyState === 4 && hasCleanedResponse) return cleanedResponse;
          const raw = responseDescriptor.get.call(this);
          const cleaned = cleanResponseValue(raw);
          if (this.readyState === 4) {
            cleanedResponse = cleaned;
            hasCleanedResponse = true;
          }
          return cleaned;
        },
      });
    }

    xhr.addEventListener("load", () => {
      try {
        let raw;
        if (responseDescriptor && typeof responseDescriptor.get === "function") {
          raw = responseDescriptor.get.call(xhr);
        } else {
          try { raw = xhr.responseText; } catch {}
        }
        const cleaned = cleanResponseValue(raw);
        const detail = typeof cleaned === "string"
          ? cleaned
          : JSON.stringify(cleaned);
        window.dispatchEvent(new CustomEvent("dsm:sd", { detail }));
      } catch {
        // Ignore — the response may not be JSON or may be unreadable.
      }
    });
  } catch {
    // If the accessors cannot be redefined, leave the native XHR untouched.
  }
}

function getXhrBodyText(body) {
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  return "";
}
