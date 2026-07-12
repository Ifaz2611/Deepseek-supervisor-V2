chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === "BDS_UPDATE_LANGUAGES") {
    fetch("https://raw.githubusercontent.com/mwahidops/deepseek-memory/main/static/remote-locales.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((updates) => {
        // Save to storage — the content script's storage listener
        // will pick it up and call i18n.loadUpdatedLocales() there.
        chrome.storage.local.set({ bds_locale_updates: updates || {} });
        chrome.storage.local.set({ bds_locale_update_last_checked: new Date().toLocaleDateString() });
        sendResponse({ success: true });
      })
      .catch((error) => sendResponse({ success: false, error: String(error) }));
    return true;
  }

  if (message.type === "BDS_RESET_LANGUAGES") {
    chrome.storage.local.remove("bds_locale_updates");
    sendResponse({ success: true });
    return true;
  }

  // ── Fetch remote skill URL ──
  // The content script cannot fetch arbitrary URLs due to CORS.
  // The background service worker is not subject to CORS, so it
  // acts as a proxy to fetch the content and return it.
  if (message.type === "BDS_FETCH_SKILL_URL") {
    const rawUrl = String(message.url || "").trim();
    if (!rawUrl) {
      sendResponse({ success: false, error: "No URL provided." });
      return false;
    }

    const fetchUrl = normalizeSkillUrl(rawUrl);

    fetch(fetchUrl, {
      headers: { "Accept": "text/plain, text/markdown, text/html, */*" },
      redirect: "follow",
    })
      .then(async (res) => {
        if (!res.ok) {
          sendResponse({ success: false, error: `HTTP ${res.status}: ${res.statusText}` });
          return;
        }

        const contentType = res.headers.get("content-type") || "";
        let text = await res.text();

        // If HTML, try to extract main text content
        if (contentType.includes("text/html")) {
          text = extractTextFromHtml(text);
        }

        text = text.trim();
        if (!text) {
          sendResponse({ success: false, error: "Fetched content is empty." });
          return;
        }

        // Derive a name from the URL
        const name = deriveSkillName(rawUrl);

        sendResponse({ success: true, name, content: text });
      })
      .catch((err) => {
        sendResponse({ success: false, error: String(err.message || err) });
      });

    return true; // Keep message channel open for async response
  }

  return false;
});

/**
 * Normalize skill URLs:
 * - GitHub repo page → raw README URL
 * - GitHub blob URL → raw content URL
 * - Other URLs → pass through as-is
 */
function normalizeSkillUrl(url) {
  // GitHub blob: https://github.com/user/repo/blob/branch/path → raw
  const blobMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/
  );
  if (blobMatch) {
    return `https://raw.githubusercontent.com/${blobMatch[1]}/${blobMatch[2]}/${blobMatch[3]}/${blobMatch[4]}`;
  }

  // GitHub repo root: https://github.com/user/repo → raw README
  const repoMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/
  );
  if (repoMatch) {
    return `https://raw.githubusercontent.com/${repoMatch[1]}/${repoMatch[2]}/main/README.md`;
  }

  // Already raw.githubusercontent.com or any other URL — pass through
  return url;
}

/**
 * Derive a human-readable skill name from a URL.
 */
function deriveSkillName(url) {
  try {
    const parsed = new URL(url);
    // GitHub: user/repo
    const ghMatch = parsed.pathname.match(/^\/([^/]+)\/([^/]+)/);
    if (parsed.hostname.includes("github")) {
      if (ghMatch) return `${ghMatch[1]}/${ghMatch[2]}`;
    }
    // Fallback: last path segment or hostname
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      return last.replace(/\.(md|txt|html?)$/i, "") || parsed.hostname;
    }
    return parsed.hostname;
  } catch {
    return "Remote Skill";
  }
}

/**
 * Extract readable text from HTML.
 * Strips scripts/styles, then gets textContent.
 */
function extractTextFromHtml(html) {
  try {
    // Use a simple regex-based approach since we don't have DOMParser in SW
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "");

    // Try to find the main/article content
    const mainMatch = cleaned.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
    if (mainMatch) {
      cleaned = mainMatch[1];
    }

    // Convert common elements to text
    cleaned = cleaned
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|h[1-6]|li|tr|blockquote)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return cleaned;
  } catch {
    return html;
  }
}