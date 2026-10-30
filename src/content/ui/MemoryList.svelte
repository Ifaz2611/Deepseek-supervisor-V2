<script>
  import appState from "../state.js";
  import { normalizeMemories, saveMemoriesToStorage, deleteSingleMemory } from "../storage.js";
  import { pushConfigToPage } from "../bridge.js";
  import { t } from "../../lib/i18n.svelte.js";
  import MemoryImportModal from "./MemoryImport.svelte";

  let entries = $state(
    Object.entries(appState.memories || {}).sort((a, b) => a[0].localeCompare(b[0]))
  );

  let searchQuery = $state("");
  let filterImportance = $state("all"); // 'all' | 'always' | 'called'
  let copiedKey = $state(null);
  let fileInput = $state(null);
  let showMemoryImport = $state(false);
  let editingKey = $state(null);
  let editingValue = $state("");
  let editingImportance = $state("called");

  export function refresh() {
    entries = Object.entries(appState.memories || {}).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }

  let countAll = $derived(entries.length);
  let countAlways = $derived(entries.filter(([_, item]) => item.importance === "always").length);
  let countCalled = $derived(entries.filter(([_, item]) => (item.importance || "called") === "called").length);

  let filteredEntries = $derived(
    entries.filter(([key, item]) => {
      const importance = (item.importance || "called").toLowerCase();
      if (filterImportance !== "all" && importance !== filterImportance) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return key.toLowerCase().includes(q) || String(item.value || "").toLowerCase().includes(q);
    })
  );

  function exportMemories() {
    const data = JSON.stringify(appState.memories || {}, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bds_memories_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function triggerImport() {
    fileInput && fileInput.click();
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const raw = JSON.parse(e.target.result);
        const normalized = normalizeMemories(raw);
        if (Object.keys(normalized).length === 0) throw new Error("empty");

        const merged = { ...appState.memories, ...normalized };
        const saved = await saveMemoriesToStorage(merged);
        if (!saved) throw new Error("save failed");
        appState.memories = merged;
        refresh();
        pushConfigToPage();

        if (appState.ui) {
          appState.ui.showToast(t('memoryList.importSuccess'));
        }
      } catch (err) {
        if (appState.ui) {
          appState.ui.showToast(t('memoryList.importFailed'));
        }
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  async function copyValue(key, val) {
    try {
      await navigator.clipboard.writeText(val);
      copiedKey = key;
      setTimeout(() => {
        if (copiedKey === key) copiedKey = null;
      }, 1600);
    } catch (e) {
      console.error("Copy failed", e);
    }
  }

  async function deleteMemory(key) {
    if (!appState.settings?.skipDeletionConfirmation) {
      if (!window.confirm(`Delete memory fact "${key}"?`)) return;
    }
    delete appState.memories[key];
    await deleteSingleMemory(key);
    refresh();
    pushConfigToPage();
    if (appState.ui) {
      appState.ui.showToast(t('memoryList.deleted', { key }));
    }
  }

  function startEdit(key, item) {
    editingKey = key;
    editingValue = item.value || "";
    editingImportance = item.importance || "called";
  }

  function cancelEdit() {
    editingKey = null;
    editingValue = "";
    editingImportance = "called";
  }

  async function saveEdit() {
    if (!editingKey || !editingValue.trim()) return;
    const entry = appState.memories[editingKey];
    if (!entry) {
      cancelEdit();
      return;
    }
    entry.value = editingValue.trim();
    entry.importance = editingImportance;
    await saveMemoriesToStorage(appState.memories);
    refresh();
    pushConfigToPage();
    if (appState.ui) {
      appState.ui.showToast(t('memoryList.saved', { key: editingKey }));
    }
    cancelEdit();
  }

  function handleKeydown(e) {
    if (e.key === "Escape" && editingKey) {
      cancelEdit();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="bds-memory-container">
  <!-- Top Bar: Title & Actions -->
  <div class="bds-memory-topbar">
    <div class="bds-memory-title-group">
      <div class="bds-memory-icon-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
      </div>
      <div>
        <h3 class="bds-section-heading">{t('memoryList.title')}</h3>
        <p class="bds-section-sub">Autonomous facts remembered across conversations</p>
      </div>
    </div>

    <div class="bds-memory-top-actions">
      <button type="button" class="bds-btn-ghost-sm" onclick={exportMemories} title="Export memories as JSON">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>{t('memoryList.export')}</span>
      </button>

      <button type="button" class="bds-btn-ghost-sm" onclick={triggerImport} title="Import memories from JSON file">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>{t('memoryList.import')}</span>
      </button>

      <button type="button" class="bds-btn-scan-sm" onclick={() => showMemoryImport = true} title="Scan active DeepSeek chat for memory facts">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <span>Scan Chat</span>
      </button>

      <input
        id="bds-memory-upload"
        type="file"
        accept=".json"
        style="display: none;"
        bind:this={fileInput}
        onchange={handleImport}
      />
    </div>
  </div>

  <!-- Search and Filter Bar -->
  <div class="bds-search-filter-row">
    <div class="bds-search-bar">
      <svg class="bds-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input
        type="text"
        class="bds-search-input"
        placeholder="Search facts by keyword or key..."
        bind:value={searchQuery}
      />
      {#if searchQuery}
        <button type="button" class="bds-search-clear" onclick={() => searchQuery = ""} aria-label="Clear search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      {/if}
    </div>

    <!-- Filter Pills -->
    <div class="bds-filter-pills">
      <button
        type="button"
        class="bds-pill-btn"
        class:active={filterImportance === "all"}
        onclick={() => filterImportance = "all"}
      >
        <span>All</span>
        <span class="bds-pill-count">{countAll}</span>
      </button>

      <button
        type="button"
        class="bds-pill-btn"
        class:active={filterImportance === "always"}
        onclick={() => filterImportance = "always"}
      >
        <span class="bds-pill-dot dot-always"></span>
        <span>Always</span>
        <span class="bds-pill-count">{countAlways}</span>
      </button>

      <button
        type="button"
        class="bds-pill-btn"
        class:active={filterImportance === "called"}
        onclick={() => filterImportance = "called"}
      >
        <span class="bds-pill-dot dot-called"></span>
        <span>Called</span>
        <span class="bds-pill-count">{countCalled}</span>
      </button>
    </div>
  </div>

  <!-- Memory List Cards -->
  <div class="bds-memory-grid">
    {#if filteredEntries.length === 0}
      <div class="bds-empty-state">
        <div class="bds-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        {#if searchQuery || filterImportance !== "all"}
          <p class="bds-empty-title">No matching memories found</p>
          <p class="bds-empty-desc">Try clearing your search query or changing filters.</p>
          <button type="button" class="bds-btn-outlined bds-btn-sm" onclick={() => { searchQuery = ""; filterImportance = "all"; }}>
            Reset Filters
          </button>
        {:else}
          <p class="bds-empty-title">No memories stored yet</p>
          <p class="bds-empty-desc">
            DeepSeek will automatically remember important facts during your chat, or you can import existing memories.
          </p>
          <button type="button" class="bds-btn-primary bds-btn-sm" onclick={() => showMemoryImport = true}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            Scan Chat for Memories
          </button>
        {/if}
      </div>
    {:else}
      {#each filteredEntries as [key, item] (key)}
        <div class="bds-memory-card">
          <!-- Card Header: Key Chip + Importance Badge + Actions -->
          <div class="bds-memory-card-top">
            <div class="bds-key-info">
              <span class="bds-key-chip" title={key}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                </svg>
                <code>{key}</code>
              </span>

              <span class="bds-importance-badge" class:always={item.importance === "always"} class:called={(item.importance || "called") === "called"}>
                {#if item.importance === "always"}
                  <span class="bds-badge-pulse"></span>
                  ALWAYS
                {:else}
                  CALLED
                {/if}
              </span>
            </div>

            <div class="bds-memory-card-actions">
              <!-- Quick Copy Value -->
              <button
                type="button"
                class="bds-card-btn"
                class:copied={copiedKey === key}
                onclick={() => copyValue(key, item.value)}
                title="Copy fact value to clipboard"
              >
                {#if copiedKey === key}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span class="bds-btn-text-copied">Copied!</span>
                {:else}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                {/if}
              </button>

              <!-- Edit -->
              <button
                type="button"
                class="bds-card-btn"
                onclick={() => startEdit(key, item)}
                title="Edit this memory fact"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>

              <!-- Delete -->
              <button
                type="button"
                class="bds-card-btn danger"
                onclick={() => deleteMemory(key)}
                title="Delete this memory fact"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Card Content -->
          <div class="bds-memory-value-box">
            <p class="bds-memory-text">{item.value}</p>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<!-- Edit Memory Modal Overlay -->
{#if editingKey}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="bds-edit-overlay" onclick={cancelEdit} role="presentation">
    <div
      class="bds-edit-modal"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="bds-edit-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="bds-edit-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </div>
          <span class="bds-edit-title">{t('memoryList.editTitle')}</span>
        </div>
        <button
          type="button"
          class="bds-edit-close"
          onclick={cancelEdit}
          aria-label={t('common.close')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="bds-edit-body">
        <div class="bds-edit-field">
          <label class="bds-edit-label" for="bds-edit-key">
            <span>Key identifier</span>
            <span class="bds-field-tag">Immutable</span>
          </label>
          <input id="bds-edit-key" class="bds-edit-input locked" value={editingKey} disabled />
        </div>

        <div class="bds-edit-field">
          <label class="bds-edit-label" for="bds-edit-importance">Importance Strategy</label>
          <select id="bds-edit-importance" class="bds-edit-select" bind:value={editingImportance}>
            <option value="always">Always Injected (Every user prompt)</option>
            <option value="called">On Demand (Injected only when DeepSeek requests it)</option>
          </select>
        </div>

        <div class="bds-edit-field">
          <label class="bds-edit-label" for="bds-edit-value">Memory Fact Content</label>
          <textarea
            id="bds-edit-value"
            class="bds-edit-textarea"
            bind:value={editingValue}
            placeholder="Fact description or remembered user preference..."
            rows="4"
          ></textarea>
        </div>
      </div>

      <div class="bds-edit-footer">
        <button type="button" class="bds-btn-outlined" onclick={cancelEdit}>{t('common.cancel')}</button>
        <button type="button" class="bds-btn-primary" onclick={saveEdit}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          {t('common.save')}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Chat History Memory Import Modal -->
{#if showMemoryImport}
  <MemoryImportModal
    onclose={() => {
      showMemoryImport = false;
      refresh();
    }}
  />
{/if}
