<script>
  import SettingsPanel from "./SettingsPanel.svelte";
  import SkillList from "./SkillList.svelte";
  import MemoryList from "./MemoryList.svelte";
  import appState from "../state.js";
  import { t } from "../../lib/i18n.svelte.js";

  let { open = false, onclose } = $props();

  let settingsRef = $state(null);
  let skillsRef = $state(null);
  let memoryRef = $state(null);
  let activeTab = $state("settings");

  export function refreshSettings() { if (settingsRef) settingsRef.refresh(); }
  export function refreshSkills() { if (skillsRef) skillsRef.refresh(); }
  export function refreshMemories() { if (memoryRef) memoryRef.refresh(); }

  export async function handleClose() {
    if (settingsRef?.checkBeforeClose) {
      const ok = await settingsRef.checkBeforeClose();
      if (ok) { activeTab = "settings"; onclose(); }
    } else {
      activeTab = "settings";
      onclose();
    }
  }

  function handleOverlay(e) { if (e.target === e.currentTarget) handleClose(); }
  function handleKey(e) { if (e.key === "Escape" && open) handleClose(); }
</script>

<svelte:window on:keydown={handleKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dsm-overlay" onclick={handleOverlay}>
    <div class="dsm-modal">
      <div class="dsm-header">
        <h2 class="dsm-title">Settings</h2>
        <button class="dsm-close" type="button" onclick={handleClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14.187 13.127l-1.06 1.06L1.813 2.873l1.06-1.06z" fill="currentColor"/><path d="M13.127 1.813l1.06 1.06L2.873 14.187l-1.06-1.06z" fill="currentColor"/></svg>
        </button>
      </div>
      <div class="dsm-body">
        <nav class="dsm-sidebar">
          <button class="dsm-nav" class:dsm-nav-active={activeTab === "settings"} onclick={() => activeTab = "settings"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>General</span>
          </button>
          <button class="dsm-nav" class:dsm-nav-active={activeTab === "skills"} onclick={() => activeTab = "skills"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>Skills</span>
          </button>
          <button class="dsm-nav" class:dsm-nav-active={activeTab === "memory"} onclick={() => activeTab = "memory"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 0-10 10c0 5.52 4.48 10 10 10s10-4.48 10-10C22 6.48 17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
            <span>Memory</span>
          </button>
        </nav>
        <div class="dsm-content">
          {#if activeTab === "settings"}
            <SettingsPanel bind:this={settingsRef} onimportdata={() => { refreshSettings(); refreshSkills(); refreshMemories(); }} />
          {:else if activeTab === "skills"}
            <SkillList bind:this={skillsRef} />
          {:else if activeTab === "memory"}
            <MemoryList bind:this={memoryRef} />
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}