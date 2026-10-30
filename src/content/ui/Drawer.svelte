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

  let activeSkillsCount = $derived(
    Array.isArray(appState.skills) ? appState.skills.filter((s) => s.active).length : 0
  );
  let memoriesCount = $derived(
    appState.memories ? Object.keys(appState.memories).length : 0
  );

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

<svelte:window onkeydown={handleKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dsm-overlay" onclick={handleOverlay}>
    <div class="dsm-modal" role="dialog" aria-modal="true" aria-labelledby="dsm-title-text">
      <!-- Modal Header -->
      <div class="dsm-header">
        <div class="dsm-header-brand">
          <div class="dsm-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a5 5 0 0 0-5 5v1a4 4 0 0 0-3 3.86 4.5 4.5 0 0 0 2 3.86V17a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-1.28a4.5 4.5 0 0 0 2-3.86 4 4 0 0 0-3-3.86V7a5 5 0 0 0-5-5z"></path>
              <line x1="12" y1="2" x2="12" y2="8"></line>
              <line x1="9" y1="12" x2="15" y2="12"></line>
              <line x1="9" y1="16" x2="15" y2="16"></line>
            </svg>
          </div>
          <div>
            <div class="dsm-header-title-row">
              <h2 id="dsm-title-text" class="dsm-title">{t('drawer.title')}</h2>
              <span class="dsm-badge-v2">V2.0</span>
            </div>
            <div class="dsm-header-subtitle">
              <span class="dsm-pulse-indicator"></span>
              {#if !appState.settings?.disableMemory}
                <span>Memory Active ({memoriesCount} facts)</span>
              {:else}
                <span>Memory Paused</span>
              {/if}
            </div>
          </div>
        </div>

        <button class="dsm-close" type="button" onclick={handleClose} aria-label={t('common.close')} title="Close (Esc)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="dsm-body">
        <nav class="dsm-sidebar" aria-label="Settings navigation">
          <button
            class="dsm-nav"
            class:dsm-nav-active={activeTab === "settings"}
            onclick={() => activeTab = "settings"}
            type="button"
          >
            <span class="dsm-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </span>
            <span class="dsm-nav-label">{t('drawer.sectionSettings')}</span>
          </button>

          <button
            class="dsm-nav"
            class:dsm-nav-active={activeTab === "skills"}
            onclick={() => activeTab = "skills"}
            type="button"
          >
            <span class="dsm-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </span>
            <span class="dsm-nav-label">{t('drawer.sectionSkills')}</span>
            {#if activeSkillsCount > 0}
              <span class="dsm-nav-count">{activeSkillsCount}</span>
            {/if}
          </button>

          <button
            class="dsm-nav"
            class:dsm-nav-active={activeTab === "memory"}
            onclick={() => activeTab = "memory"}
            type="button"
          >
            <span class="dsm-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
              </svg>
            </span>
            <span class="dsm-nav-label">{t('drawer.sectionMemories')}</span>
            {#if memoriesCount > 0}
              <span class="dsm-nav-count">{memoriesCount}</span>
            {/if}
          </button>
        </nav>

        <div class="dsm-content">
          {#if activeTab === "settings"}
            <SettingsPanel
              bind:this={settingsRef}
              onimportdata={() => { refreshSettings(); refreshSkills(); refreshMemories(); }}
            />
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
