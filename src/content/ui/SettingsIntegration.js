/**
 * DeepSeek Settings Integration
 *
 * Injects a "Memory & Skills" entry into DeepSeek's native settings dropdown
 * (the menu that opens from the user/settings icon at the top of the page).
 * Clicking the entry dispatches a `bds:open-drawer` event, which App.svelte
 * picks up to open our BDS drawer panel.
 */

const ENTRY_ID = "bds-settings-entry";
const ENTRY_CLASS = "bds-settings-entry";

// Settings cog dropdown menu items DeepSeek ships with — we anchor next to them.
const ANCHOR_LABELS = ["Download mobile App", "Get App"];

// SVG icon (brain + bookmark glyph) sized for DS dropdown rows.
const ICON_SVG = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v.5a3 3 0 0 0-3 3v.5A2.5 2.5 0 0 0 2 11v2a2.5 2.5 0 0 0 2 2.5v.5a3 3 0 0 0 3 3v.5A2.5 2.5 0 0 0 9.5 22h5a2.5 2.5 0 0 0 2.5-2.5V19a3 3 0 0 0 3-3v-.5A2.5 2.5 0 0 0 22 13v-2a2.5 2.5 0 0 0-2-2.5V8a3 3 0 0 0-3-3v-.5A2.5 2.5 0 0 0 14.5 2h-5z"></path>
  <path d="M12 8v8"></path>
  <path d="M9 11h6"></path>
  <path d="M9 14h6"></path>
</svg>`;

let observerStarted = false;
let pollTimer = null;

// DeepSeek's dropdown has changed class names across versions. We try a broad
// set of selectors so the integration doesn't silently break.
const MENU_SELECTORS = [
  ".ds-dropdown-menu",
  "[role='menu']",
  "[data-radix-popper-content-wrapper]",
  ".dropdown-menu",
  "[class*='dropdown']",
];

let lastInjectAttempt = 0;

function isDropdownCandidate(el) {
  if (!el || el.nodeType !== 1) return false;
  // Has at least 2 clickable rows and looks like a settings menu
  const hasOptions = el.querySelectorAll("[class*='dropdown'], [role='menuitem'], [class*='menu-option']").length >= 1;
  return hasOptions || MENU_SELECTORS.some((sel) => el.matches && el.matches(sel));
}

/**
 * Public API used by content/index.js — starts the integration once and only once.
 */
export function initSettingsIntegration() {
  if (observerStarted) return;
  observerStarted = true;

  // Run once on init in case the dropdown is already mounted.
  scanAndInject();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        // Direct match
        if (isDropdownCandidate(node)) {
          injectEntry(node);
          // Also check inside
          node.querySelectorAll && MENU_SELECTORS.forEach((sel) => {
            node.querySelectorAll(sel).forEach(injectEntry);
          });
          continue;
        }
        // Search descendants for any menu
        if (node.querySelectorAll) {
          let found = false;
          for (const sel of MENU_SELECTORS) {
            const nested = node.querySelector(sel);
            if (nested) { injectEntry(nested); found = true; break; }
          }
          if (!found) {
            // Last resort: if added node contains our anchor text, its ancestor is the menu
            const txt = node.textContent || "";
            if (ANCHOR_LABELS.some((a) => txt.includes(a))) {
              const ancestor = node.closest ? node.closest("[class*='dropdown'], [role='menu'], div") : null;
              if (ancestor) injectEntry(ancestor);
              // Also try the parent
              if (node.parentElement) injectEntry(node.parentElement);
            }
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Polling fallback: if MutationObserver misses (e.g. portal inside shadow),
  // scan every 1.5s for a visible menu that hasn't been injected yet.
  pollTimer = setInterval(() => {
    // Throttle: at most once per second actually scans DOM heavily
    if (Date.now() - lastInjectAttempt < 1000) return;
    lastInjectAttempt = Date.now();
    scanAndInject();
  }, 1500);
}

/**
 * Scan visible dropdowns once. Useful right after the content script boots,
 * before the observer picks anything up.
 */
function scanAndInject() {
  for (const sel of MENU_SELECTORS) {
    document.querySelectorAll(sel).forEach((menu) => injectEntry(menu));
  }
  // Also scan any element that contains the anchor text but wasn't caught by selectors
  const all = document.querySelectorAll("div, ul");
  for (const el of all) {
    if (el.querySelector && el.querySelector("." + ENTRY_CLASS)) continue;
    const label = el.textContent || "";
    if (ANCHOR_LABELS.some((a) => label.includes(a)) && el.children.length > 1) {
      // Heuristic: element with anchor text and multiple children is likely a menu
      // Check parents up to 3 levels
      let cur = el;
      for (let i = 0; i < 3 && cur; i++) {
        if (cur.children.length >= 2 && cur.children.length <= 20) {
          injectEntry(cur);
          break;
        }
        cur = cur.parentElement;
      }
    }
  }
}

/**
 * Inject the BDS entry into a settings dropdown menu if it looks like the
 * settings menu (i.e. it contains one of the ANCHOR_LABELS).
 */
function injectEntry(menu) {
  if (!menu || !menu.querySelector) return;
  if (menu.querySelector("." + ENTRY_CLASS)) return;

  const anchorOption = findAnchorOption(menu);
  // If we can't find the anchor text, still inject at the end — better than
  // showing nothing. The menu is at least a dropdown candidate.
  if (!anchorOption) {
    // Only do fallback insertion if menu looks like a real menu (has children)
    if (menu.children && menu.children.length >= 1 && menu.children.length <= 30) {
      // Avoid injecting into giant containers (e.g. body)
      const isSmallMenu = menu.children.length <= 12 || menu.getBoundingClientRect().height < 600;
      if (isSmallMenu) {
        const entry = buildEntry();
        menu.appendChild(entry);
      }
    }
    return;
  }

  const entry = buildEntry();
  const reference = anchorOption.nextSibling;
  anchorOption.parentNode.insertBefore(entry, reference);
}

/**
 * Find the menu option we want to anchor next to ("Get App" or "Download mobile App").
 */
function findAnchorOption(menu) {
  // Try the DeepSeek-specific selector first
  const options = menu.querySelectorAll(".ds-dropdown-menu-option, [role='menuitem'], [class*='menu-option'], [class*='dropdown'] > div, li, button");
  for (const opt of options) {
    // Skip our own entry
    if (opt.classList && opt.classList.contains(ENTRY_CLASS)) continue;
    const label = opt.querySelector(".ds-dropdown-menu-option__label") || opt;
    const text = (label.textContent || "").trim();
    if (!text) continue;
    if (ANCHOR_LABELS.some((needle) => text.includes(needle))) {
      // Return the row element (the option itself, not the inner label)
      return opt.closest ? (opt.closest(".ds-dropdown-menu-option") || opt) : opt;
    }
  }
  // Fallback: text search across all descendants
  const allNodes = menu.querySelectorAll("*");
  for (const n of allNodes) {
    if (n.children.length !== 0) continue; // leaf only to avoid matching container
    const t = (n.textContent || "").trim();
    if (ANCHOR_LABELS.some((a) => t.includes(a))) {
      return n.closest ? (n.closest("div, li, button, [role='menuitem']") || n) : n;
    }
  }
  return null;
}

/**
 * Build the menu option DOM node using DeepSeek's own dropdown classes so it
 * blends in with the native look.
 */
function buildEntry() {
  const opt = document.createElement("div");
  opt.id = ENTRY_ID;
  opt.className = "ds-dropdown-menu-option ds-dropdown-menu-option--none " + ENTRY_CLASS;

  const icon = document.createElement("div");
  icon.className = "ds-dropdown-menu-option__icon";
  icon.innerHTML = ICON_SVG;

  const label = document.createElement("div");
  label.className = "ds-dropdown-menu-option__label";
  label.textContent = "Memory & Skills";

  opt.appendChild(icon);
  opt.appendChild(label);

  opt.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Close the DeepSeek dropdown by clicking the body — lets React unmount it
    // naturally without us ripping nodes out of the virtual DOM.
    document.body.click();

    // Ask App.svelte to open the settings modal.
    window.dispatchEvent(new CustomEvent("dsm:open"));
  });

  return opt;
}