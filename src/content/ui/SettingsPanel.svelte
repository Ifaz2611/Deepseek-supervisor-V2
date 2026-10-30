<script>
  import { onMount } from "svelte";
  import appState from "../state.js";
  import { pushConfigToPage } from "../bridge.js";
  import { STORAGE_KEYS } from "../../lib/constants.js";
  import { t, i18n, availableLocaleCodes } from "../../lib/i18n.svelte.js";

  let { onimportdata } = $props();

  let disableMemory = $state(Boolean(appState.settings.disableMemory));
  let locale = $state(appState.settings.locale || availableLocaleCodes[0] || "en");
  let syncLocale = $state(Boolean(appState.settings.syncLocale));
  let persistentMemory = $state(!appState.settings.disableMemory);

  let activeSkillsCount = $derived(
    Array.isArray(appState.skills) ? appState.skills.filter((s) => s.active).length : 0
  );
  let memoriesCount = $derived(
    appState.memories ? Object.keys(appState.memories).length : 0
  );

  // Auto-save when any toggle changes
  let _initDone = false;
  $effect(() => {
    const _ = persistentMemory;
    const __ = syncLocale;
    const ___ = locale;
    if (!_initDone) { _initDone = true; return; }
    disableMemory = !persistentMemory;
    autoSave();
  });

  export function refresh() {
    disableMemory = Boolean(appState.settings.disableMemory);
    persistentMemory = !disableMemory;
    locale = appState.settings.locale || availableLocaleCodes[0] || "en";
    syncLocale = Boolean(appState.settings.syncLocale);
  }

  export function checkBeforeClose() {
    return Promise.resolve(true);
  }

  async function autoSave() {
    appState.settings.disableMemory = disableMemory;
    appState.settings.locale = locale;
    appState.settings.syncLocale = syncLocale;
    await chrome.storage.local.set({
      [STORAGE_KEYS.settings]: appState.settings,
    });
    if (!syncLocale) {
      i18n.setLocale(locale);
    }
    pushConfigToPage();
  }

  onMount(() => {
    refresh();
  });
</script>

<div class="bds-panel-container">
  <!-- Status Hero Card -->
  <div class="bds-hero-card">
    <div class="bds-hero-header">
      <div class="bds-hero-icon-wrap">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a5 5 0 0 0-5 5v1a4 4 0 0 0-3 3.86 4.5 4.5 0 0 0 2 3.86V17a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-1.28a4.5 4.5 0 0 0 2-3.86 4 4 0 0 0-3-3.86V7a5 5 0 0 0-5-5z"></path>
          <line x1="12" y1="2" x2="12" y2="8"></line>
        </svg>
      </div>
      <div>
        <h3 class="bds-hero-title">DeepSeek Supervisor V2</h3>
        <p class="bds-hero-desc">Persistent local memory & custom skills engine</p>
      </div>
    </div>
    <div class="bds-hero-metrics">
      <div class="bds-metric-pill">
        <span class="bds-metric-dot" class:bds-metric-dot-green={persistentMemory} class:bds-metric-dot-red={!persistentMemory}></span>
        <span class="bds-metric-label">Memory:</span>
        <span class="bds-metric-value">{persistentMemory ? "Active" : "Disabled"}</span>
      </div>
      <div class="bds-metric-pill">
        <span class="bds-metric-icon">🧠</span>
        <span class="bds-metric-label">Facts:</span>
        <span class="bds-metric-value">{memoriesCount}</span>
      </div>
      <div class="bds-metric-pill">
        <span class="bds-metric-icon">⚡</span>
        <span class="bds-metric-label">Skills:</span>
        <span class="bds-metric-value">{activeSkillsCount} active</span>
      </div>
    </div>
  </div>

  <!-- Settings Cards -->
  <div class="bds-cards-group">
    <!-- Persistent Memory Toggle Card -->
    <div class="bds-card-row">
      <div class="bds-card-info">
        <div class="bds-card-icon-title">
          <span class="bds-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a5 5 0 0 0-5 5v1a4 4 0 0 0-3 3.86 4.5 4.5 0 0 0 2 3.86V17a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-1.28a4.5 4.5 0 0 0 2-3.86 4 4 0 0 0-3-3.86V7a5 5 0 0 0-5-5z"></path>
              <line x1="9" y1="12" x2="15" y2="12"></line>
              <line x1="9" y1="16" x2="15" y2="16"></line>
            </svg>
          </span>
          <span class="bds-card-title">{t('settings.persistentMemory')}</span>
        </div>
        <p class="bds-card-hint">{t('settings.persistentMemoryHint')}</p>
      </div>

      <label class="bds-switch" for="bds-persistent-memory">
        <input id="bds-persistent-memory" type="checkbox" bind:checked={persistentMemory} />
        <span class="bds-switch-track"></span>
      </label>
    </div>

    <!-- Sync Browser Language Toggle Card -->
    <div class="bds-card-row">
      <div class="bds-card-info">
        <div class="bds-card-icon-title">
          <span class="bds-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </span>
          <span class="bds-card-title">{t('settings.syncLocale')}</span>
        </div>
        <p class="bds-card-hint">Automatically match extension UI language to your browser.</p>
      </div>

      <label class="bds-switch" for="bds-sync-locale">
        <input id="bds-sync-locale" type="checkbox" bind:checked={syncLocale} />
        <span class="bds-switch-track"></span>
      </label>
    </div>

    <!-- Language Select (if sync is off) -->
    {#if !syncLocale}
      <div class="bds-card-row bds-card-row-sub">
        <div class="bds-card-info">
          <span class="bds-card-title">{t('settings.selectLanguage')}</span>
        </div>
        <select class="bds-select bds-select-styled" bind:value={locale}>
          {#each availableLocaleCodes as code}
            <option value={code}>{i18n.getNativeName(code)}</option>
          {/each}
        </select>
      </div>
    {/if}
  </div>

  <!-- Footer Info -->
  <div class="bds-settings-footer-card">
    <div class="bds-footer-left">
      <span class="bds-footer-shield">🛡️ 100% Local Storage</span>
      <span class="bds-footer-dot">•</span>
      <span class="bds-footer-text">Zero telemetry</span>
    </div>
    <a
      class="bds-github-badge"
      href="https://github.com/Ifaz2611/Deepseek-supervisor-V2"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
      </svg>
      <span>GitHub Repo</span>
    </a>
  </div>
</div>
