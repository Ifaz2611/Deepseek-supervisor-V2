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

  // Auto-save when any toggle changes
  let _initDone = false;
  $effect(() => {
    // Track all reactive values
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

<div class="bds-section-title">
  <span class="bds-icon-inline">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1l2 4 4 .5-3 3 .8 4.5L8 11l-3.8 2 .8-4.5-3-3L6 5z" fill="currentColor"/>
    </svg>
  </span>
  {t('settings.generalSettings')}
</div>

<div class="bds-toggle-row">
  <span class="bds-toggle-label">{t('settings.persistentMemory')}</span>
  <label class="bds-switch">
    <input id="bds-persistent-memory" type="checkbox" bind:checked={persistentMemory} />
    <span class="bds-switch-track"></span>
  </label>
</div>
<p style="font-size: 10px; opacity: 0.5; margin: -8px 0 12px;">
  {t('settings.persistentMemoryHint')}
</p>

<div class="bds-toggle-row">
  <span class="bds-toggle-label">{t('settings.syncLocale')}</span>
  <label class="bds-switch">
    <input type="checkbox" bind:checked={syncLocale} />
    <span class="bds-switch-track"></span>
  </label>
</div>

{#if !syncLocale}
  <div class="bds-toggle-row">
    <span class="bds-toggle-label">{t('settings.selectLanguage')}</span>
    <select class="bds-select" bind:value={locale} style="width: 140px;">
      {#each availableLocaleCodes as code}
        <option value={code}>{i18n.getNativeName(code)}</option>
      {/each}
    </select>
  </div>
{/if}

<div class="bds-settings-footer">
  <a class="bds-github-link" href="https://github.com/Ifaz2611/Deepseek-supervisor-V2" target="_blank" rel="noopener noreferrer">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
    <span>DeepSeek Supervisor v1.0.0</span>
  </a>
</div>