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
        if (node.classList && node.classList.contains("ds-dropdown-menu")) {
          injectEntry(node);
          continue;
        }
        const nested = node.querySelector && node.querySelector(".ds-dropdown-menu");
        if (nested) injectEntry(nested);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Scan visible dropdowns once. Useful right after the content script boots,
 * before the observer picks anything up.
 */
function scanAndInject() {
  const menus = document.querySelectorAll(".ds-dropdown-menu");
  menus.forEach((menu) => injectEntry(menu));
}

/**
 * Inject the BDS entry into a settings dropdown menu if it looks like the
 * settings menu (i.e. it contains one of the ANCHOR_LABELS).
 */
function injectEntry(menu) {
  if (!menu || menu.querySelector("." + ENTRY_CLASS)) return;

  const anchorOption = findAnchorOption(menu);
  if (!anchorOption) return;

  const entry = buildEntry();
  const reference = anchorOption.nextSibling;
  anchorOption.parentNode.insertBefore(entry, reference);
}

/**
 * Find the menu option we want to anchor next to ("Get App" or "Download mobile App").
 */
function findAnchorOption(menu) {
  const options = menu.querySelectorAll(".ds-dropdown-menu-option");
  for (const opt of options) {
    const label = opt.querySelector(".ds-dropdown-menu-option__label");
    if (!label) continue;
    const text = label.textContent.trim();
    if (ANCHOR_LABELS.some((needle) => text.includes(needle))) {
      return opt;
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