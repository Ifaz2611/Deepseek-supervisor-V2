import state from "../state.js";
import { pushConfigToPage } from "../bridge.js";
import { STORAGE_KEYS } from "../../lib/constants.js";
import { makeId } from "../../lib/utils/helpers.js";

let skillPersistTimer = 0;

/**
 * Upsert skill entries and persist to storage.
 * Skills are additive — multiple skills can coexist and be active.
 */
export async function upsertSkills(items) {
  if (!items || items.length === 0) return;

  let changed = false;

  for (const item of items) {
    const name = String(item.name || "New Skill").trim();
    const usage = String(item.usage || "").trim();
    const content = String(item.content || "").trim();

    if (!content) continue;

    const existing = state.skills.find(s => s.name === name && s.usage === usage && s.content === content);
    if (existing) {
      if (!existing.active) {
        existing.active = true;
        changed = true;
      }
      continue;
    }

    state.skills.push({
      id: makeId(),
      name,
      usage,
      content,
      active: true
    });

    changed = true;
  }

  if (!changed) {
    return;
  }

  if (state.ui) {
    state.ui.refreshSkills();
  }
  pushConfigToPage();

  if (skillPersistTimer) {
    window.clearTimeout(skillPersistTimer);
  }

  skillPersistTimer = window.setTimeout(async () => {
    skillPersistTimer = 0;
    await chrome.storage.local.set({
      [STORAGE_KEYS.skills]: state.skills,
    });
  }, 300);
}
