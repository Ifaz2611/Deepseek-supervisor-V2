import { mutatePayload, stripBlocksFromJsonValue } from "./payload-mutator.js";

export function patchFetch(state, isChatCompletionUrl, requestFreshConfig) {
  const originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    try {
      const url = extractUrl(input);
      if (!isChatCompletionUrl(url)) return originalFetch.apply(this, arguments);

      // Request fresh config before mutating (ensures memories are up-to-date)
      if (requestFreshConfig) requestFreshConfig();

      if (url.includes("/api/v0/chat_session/fetch_page")) {
        const response = await originalFetch.apply(this, arguments);
        try {
          const cloned = response.clone();
          const data = await cloned.json();
          // Strip injected blocks from chat history so the user
          // never sees raw BDS tags in the message bubbles.
          const cleaned = stripBlocksFromJsonValue(data);
          window.dispatchEvent(new CustomEvent("dsm:sd", { detail: JSON.stringify(cleaned) }));
          // Return a new Response with cleaned data
          return new Response(JSON.stringify(cleaned), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch (e) {
          return response;
        }
      }

      const bodyText = await extractBodyText(input, init);
      if (!bodyText) return originalFetch.apply(this, arguments);

      let payload;
      try { payload = JSON.parse(bodyText); } catch { return originalFetch.apply(this, arguments); }

      const mutation = mutatePayload(payload, state);
      if (!mutation.changed) return originalFetch.apply(this, arguments);

      const nextBody = JSON.stringify(mutation.payload);
      const sourceHeaders = (init && init.headers) || (input instanceof Request ? input.headers : undefined);
      const headers = new Headers(sourceHeaders || {});
      headers.set("content-type", "application/json");

      const nextInit = {
        method: (init && init.method) || (input instanceof Request ? input.method : "POST"),
        headers,
        body: nextBody,
        credentials: (init && init.credentials) || (input instanceof Request ? input.credentials : undefined),
        cache: (init && init.cache) || (input instanceof Request ? input.cache : undefined),
        mode: (init && init.mode) || (input instanceof Request ? input.mode : undefined),
        redirect: (init && init.redirect) || (input instanceof Request ? input.redirect : undefined),
        referrer: (init && init.referrer) || (input instanceof Request ? input.referrer : undefined),
        referrerPolicy: (init && init.referrerPolicy) || (input instanceof Request ? input.referrerPolicy : undefined),
        keepalive: (init && init.keepalive) || (input instanceof Request ? input.keepalive : undefined),
        integrity: (init && init.integrity) || (input instanceof Request ? input.integrity : undefined),
        signal: (init && init.signal) || (input instanceof Request ? input.signal : undefined),
      };

      const nextInput = typeof input === "string" || input instanceof URL ? input : input.url;
      return originalFetch.call(this, nextInput, nextInit);
    } catch (error) {
      return originalFetch.apply(this, arguments);
    }
  };
}

function extractUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return "";
}

async function extractBodyText(input, init) {
  try {
    if (init && typeof init.body === "string") return init.body;
    if (input instanceof Request) { try { return await input.clone().text(); } catch { return null; } }
    if (init && init.body) { try { return typeof init.body === "string" ? init.body : String(init.body); } catch { return null; } }
  } catch { return null; }
  return null;
}